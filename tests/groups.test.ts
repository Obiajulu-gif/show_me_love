import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let sessionUser: { id: string; email: string; role: string } | null = null;
vi.mock("../src/lib/session", async (orig) => {
  const m = await orig<typeof import("../src/lib/session")>();
  return { ...m, requireUser: vi.fn(async () => { if (!sessionUser) throw new m.Unauthorized(); return sessionUser; }) };
});
let ip = "7.7.7.7";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": ip }) }));
vi.mock("../src/lib/ras", async (orig) => ({ ...(await orig<typeof import("../src/lib/ras")>()), createPaymentLink: vi.fn() }));
vi.mock("../src/lib/rates", async (orig) => ({ ...(await orig<typeof import("../src/lib/rates")>()), getRate: vi.fn() }));

import { POST as checkRoute } from "../src/app/api/groups/check/route";
import { POST as payRoute } from "../src/app/api/groups/route";
import { createCreator } from "../src/lib/creators";
import { db } from "../src/lib/db";
import { refundPayment } from "../src/lib/admin";
import { checkGroup, groupHistory, parseUsernames, startGroupCheckout } from "../src/lib/groups";
import { balance } from "../src/lib/ledger";
import { handleRasEvent } from "../src/lib/payments";
import { createPaymentLink } from "../src/lib/ras";
import { getRate } from "../src/lib/rates";
import { listPayments, overview } from "../src/lib/stats";
import { startTestDb } from "../src/lib/testing";
import { renameUsername } from "../src/lib/usernames";

let t: Awaited<ReturnType<typeof startTestDb>>;
let payer: string;
const ids: Record<string, string> = {};
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  vi.stubEnv("PUBLIC_APP_URL", "https://sml.test");
  t = await startTestDb();
  [{ id: payer }] = await t.sql`insert into users (email) values ('payer@x.com') returning id`;
  await createCreator(payer, { username: "payer_p", treatId: "zobo" });
  for (const n of ["ada_bakes", "bola_b", "chi_c"]) {
    const [{ id }] = await t.sql`insert into users (email) values (${n + "@x.com"}) returning id`;
    ids[n] = id;
    await createCreator(id, { username: n, treatId: "zobo" });
  }
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  sessionUser = { id: payer, email: "payer@x.com", role: "creator" };
  vi.mocked(getRate).mockResolvedValue({ ngnPerUsd: 1500, at: new Date() });
  vi.mocked(createPaymentLink).mockReset();
  vi.mocked(createPaymentLink).mockResolvedValue({ refid: "r1", payment_link: null, wallets: [], expires_at: "" });
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from payments`;
  await t.sql`delete from group_payments`;
});

const base = { currency: "USD" as const, total: 10, split: "even" as const, isPublic: true };
const pay = (usernames: string[], over: Record<string, unknown> = {}) => startGroupCheckout(payer, { ...base, usernames, ...over } as never);

test("parseUsernames splits, trims, strips @, lowercases, dedupes", () => {
  expect(parseUsernames("@Ada, bob\nada")).toEqual(["ada", "bob"]);
  expect(parseUsernames("  , \n")).toEqual([]);
});

test("needs 2 to 10 distinct creators", async () => {
  await expect(pay(["ada_bakes"])).rejects.toThrow("Add 2–10 creators.");
  await expect(pay(["ada_bakes", "@ADA_BAKES"])).rejects.toThrow("Add 2–10 creators.");
  const eleven = Array.from({ length: 11 }, (_, i) => `person_${i}`);
  await expect(pay(eleven)).rejects.toThrow("Add 2–10 creators.");
});

test("rejects missing names and the payer's own username", async () => {
  await expect(pay(["ada_bakes", "nobody_here"])).rejects.toThrow("nobody_here");
  await expect(pay(["ada_bakes", "payer_p"])).rejects.toThrow("your own");
  expect(await checkGroup(["Ada_Bakes", "nobody_here"])).toMatchObject({ ok: [{ username: "ada_bakes" }], missing: ["nobody_here"] });
});

test("amount rules: minimums per creator, units, custom must sum", async () => {
  await expect(pay(["ada_bakes", "bola_b"], { currency: "NGN", total: 199 })).rejects.toThrow(/at least/);
  await expect(pay(["ada_bakes", "bola_b"], { currency: "NGN", total: 500.5 })).rejects.toThrow();
  await expect(pay(["ada_bakes", "bola_b"], { total: 1.99 })).rejects.toThrow(/at least/);
  await expect(pay(["ada_bakes", "bola_b"], { total: 10.123 })).rejects.toThrow();
  await expect(pay(["ada_bakes", "bola_b"], { split: { custom: { ada_bakes: 6, bola_b: 3.99 } } })).rejects.toThrow("Split amounts must add up to the total.");
  await expect(pay(["ada_bakes", "bola_b"], { split: { custom: { ada_bakes: 10, bola_b: 0 } } })).rejects.toThrow();
  await expect(pay(["ada_bakes", "bola_b"], { split: { custom: { ada_bakes: 10 } } })).rejects.toThrow();
  // 0.1 + 0.2 style float sums must still be exact in minor units
  const ok = await pay(["ada_bakes", "bola_b"], { total: 3, split: { custom: { ada_bakes: 1.1, bola_b: 1.9 } } });
  expect(ok.ref).toHaveLength(20);
});

test("checkout writes one payment, one group, one split per creator, in order; link failure marks it failed", async () => {
  const out = await pay(["bola_b", "ada_bakes", "chi_c"], { total: 10, message: "party" });
  const [p] = await t.sql`select * from payments where ref = ${out.ref}`;
  expect(p).toMatchObject({ kind: "group", creator_id: null, status: "pending", supporter_email: "payer@x.com", message: "party" });
  expect(Number(p.amount_ngn)).toBe(15000);
  const sp = await t.sql`select c.username, s.share_amount::text as a, s.ordinal from group_splits s join creators c on c.user_id = s.creator_id where s.group_id = ${p.group_id} order by s.ordinal`;
  expect(sp.map((r) => r.username)).toEqual(["bola_b", "ada_bakes", "chi_c"]);
  expect(out.url).toContain("/dashboard/group?ref=" + out.ref + "&thanks=1");
  expect(vi.mocked(createPaymentLink).mock.calls[0][0].successUrl).toBe(`https://sml.test/dashboard/group?ref=${out.ref}&thanks=1`);

  vi.mocked(createPaymentLink).mockRejectedValueOnce(new Error("boom"));
  await expect(pay(["bola_b", "ada_bakes"])).rejects.toThrow(/busy/);
  const [f] = await t.sql`select status from payments where kind = 'group' order by created_at desc limit 1`;
  expect(f.status).toBe("failed");
});

test("historical names resolve to the current creator and dedupe", async () => {
  await renameUsername(db(), ids.chi_c, "chi_new");
  const out = await pay(["chi_c", "chi_new", "ada_bakes"]);
  const sp = await t.sql`select c.username from group_splits s join creators c on c.user_id = s.creator_id join payments p on p.group_id = s.group_id where p.ref = ${out.ref} order by s.ordinal`;
  expect(sp.map((r) => r.username)).toEqual(["chi_new", "ada_bakes"]);
  await renameUsername(db(), ids.chi_c, "chi_c");
});

const done = (ref: string, usdt: string, id = `e_${ref}`) =>
  handleRasEvent({ event_id: id, event_type: "payment_link_completed", meta_data: { payment_reference: ref, amount_received: usdt } });

test("an even split of 10.00 across 3 credits 3.333334, 3.333333, 3.333333, each charged their own fee", async () => {
  const out = await pay(["ada_bakes", "bola_b", "chi_c"]);
  expect(await done(out.ref, "10.00")).toEqual({ handled: true });
  const rows = await t.sql`select c.username, e.kind, e.amount_usdt::text as v, e.ref from ledger_entries e join creators c on c.user_id = e.creator_id order by c.username, e.kind`;
  const credit = (u: string) => rows.find((r) => r.username === u && r.kind === "credit")!;
  const fee = (u: string) => rows.find((r) => r.username === u && r.kind === "fee")!;
  expect([credit("ada_bakes").v, credit("bola_b").v, credit("chi_c").v]).toEqual(["3.333334", "3.333333", "3.333333"]);
  expect([fee("ada_bakes").v, fee("bola_b").v]).toEqual(["-0.166666", "-0.166666"]);
  expect(credit("ada_bakes").ref).toBe(`pay:${out.ref}:${ids.ada_bakes}`);
  expect(fee("chi_c").ref).toBe(`fee:${out.ref}:${ids.chi_c}`);
  expect(rows).toHaveLength(6);
  expect(await balance(ids.bola_b)).toBe("3.166667");
});

test("custom split credits by weight; replayed event and a second completion add nothing", async () => {
  const out = await pay(["ada_bakes", "bola_b"], { currency: "NGN", total: 3000, split: { custom: { ada_bakes: 2000, bola_b: 1000 } } });
  await done(out.ref, "2.00", "a");
  expect(await balance(ids.ada_bakes)).toBe("1.266668");
  expect(await balance(ids.bola_b)).toBe("0.633333");
  expect(await done(out.ref, "2.00", "a")).toEqual({ handled: false, reason: "duplicate" });
  await done(out.ref, "2.00", "b");
  expect(await balance(ids.ada_bakes)).toBe("1.266668");
});

test("a ledger collision rolls the whole credit back", async () => {
  const out = await pay(["ada_bakes", "bola_b"]);
  await t.sql`insert into ledger_entries (creator_id, kind, amount_usdt, ref) values (${ids.bola_b}, 'credit', '1', ${`pay:${out.ref}:${ids.bola_b}`})`;
  await expect(done(out.ref, "10.00", "c")).rejects.toThrow();
  const [p] = await t.sql`select status from payments where ref = ${out.ref}`;
  expect(p.status).toBe("pending");
  expect(await balance(ids.ada_bakes)).toBe("0.000000");
  expect(await t.sql`select 1 from webhook_events where event_id = 'c'`).toHaveLength(0);
});

test("the group shows as viaGroup in each creator's list with their share, and counts as a treat", async () => {
  const out = await pay(["ada_bakes", "bola_b", "chi_c"]);
  let l = await listPayments(ids.ada_bakes, "all");
  expect(l.rows).toHaveLength(1);
  expect(l.rows[0]).toMatchObject({ ref: out.ref, viaGroup: true, status: "pending", amountUsdt: "3.33", amountNgn: 5000 });
  expect((await overview(ids.ada_bakes)).treatCount).toBe(0);
  await done(out.ref, "10.00");
  for (const n of ["ada_bakes", "bola_b", "chi_c"]) {
    l = await listPayments(ids[n], "successful");
    expect(l.count).toBe(1);
    expect(l.rows[0].viaGroup).toBe(true);
  }
  expect((await listPayments(ids.ada_bakes, "successful")).rows[0].amountUsdt).toBe("3.33");
  expect((await overview(ids.bola_b)).treatCount).toBe(1);
  expect((await listPayments(payer, "all")).rows).toHaveLength(0);
});

test("groupHistory lists the payer's own groups newest first", async () => {
  const a = await pay(["ada_bakes", "bola_b"]);
  const b = await pay(["chi_c", "ada_bakes"], { currency: "NGN", total: 500 });
  const h = await groupHistory(payer);
  expect(h.map((x) => x.ref)).toEqual([b.ref, a.ref]);
  expect(h[0]).toMatchObject({ status: "pending", total: 500, currency: "NGN", members: ["chi_c", "ada_bakes"] });
  expect(await groupHistory(ids.ada_bakes)).toEqual([]);
});

const req = (body: unknown, path = "groups") =>
  new Request(`http://localhost/api/${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body) });

test("routes: 401 signed out, strict 400s, cross-site refused, success", async () => {
  sessionUser = null;
  expect((await payRoute(req({}))).status).toBe(401);
  expect((await checkRoute(req({}, "groups/check"))).status).toBe(401);
  sessionUser = { id: payer, email: "payer@x.com", role: "creator" };
  const good = { usernames: ["ada_bakes", "bola_b"], currency: "USD", total: 10, split: "even", isPublic: true };
  for (const bad of [[], "nope{", { ...good, usernames: "ada" }, { ...good, usernames: [1, 2] }, { ...good, total: "10" }, { ...good, currency: "EUR" },
    { ...good, split: "half" }, { ...good, split: { custom: [] } }, { ...good, split: { custom: { ada_bakes: "6" } } }, { ...good, isPublic: "y" }, { ...good, message: 5 }]) {
    const r = await payRoute(req(bad));
    expect(r.status).toBe(400);
    expect(typeof (await r.json()).error).toBe("string");
  }
  const xs = await payRoute(new Request("http://localhost/api/groups", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.test" }, body: JSON.stringify(good) }));
  expect(xs.status).toBe(403);
  const r = await payRoute(req(good));
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({ ok: true, ref: expect.any(String), url: expect.any(String) });
  expect((await payRoute(req({ ...good, usernames: ["ada_bakes"] }))).status).toBe(400);
  const c = await checkRoute(req({ usernames: ["Ada_Bakes", "zz_nobody"] }, "groups/check"));
  expect(await c.json()).toMatchObject({ ok: [{ username: "ada_bakes" }], missing: ["zz_nobody"] });
  expect((await checkRoute(req({ usernames: "x" }, "groups/check"))).status).toBe(400);
});

test("the 11th group checkout from one IP is rate limited", async () => {
  ip = "8.8.8.8";
  const good = { usernames: ["ada_bakes", "bola_b"], currency: "USD", total: 10, split: "even", isPublic: true };
  for (let i = 0; i < 10; i++) expect((await payRoute(req(good))).status).toBe(200);
  expect((await payRoute(req(good))).status).toBe(429);
});

test("group payments can't be refunded yet", async () => {
  const [{ id: admin }] = await t.sql`insert into users (email, role) values ('boss@x.com', 'admin') returning id`;
  const out = await pay(["ada_bakes", "bola_b"]);
  await done(out.ref, "10.00", "r");
  await expect(refundPayment(admin, out.ref, { address: "0x" + "a".repeat(40), network: "bep20" })).rejects.toThrow("Group payments can't be refunded yet.");
  expect(await balance(ids.ada_bakes)).not.toBe("0.000000");
});
