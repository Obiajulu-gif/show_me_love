import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let sessionUser: { id: string; email: string; role: string } | null = null;
vi.mock("../src/lib/session", async (orig) => {
  const m = await orig<typeof import("../src/lib/session")>();
  return { ...m, requireUser: vi.fn(async () => { if (!sessionUser) throw new m.Unauthorized(); return sessionUser; }) };
});
vi.mock("../src/lib/email", async (orig) => ({ ...(await orig<typeof import("../src/lib/email")>()), sendMail: vi.fn(async () => {}) }));
vi.mock("../src/lib/ras", async (orig) => {
  const m = await orig<typeof import("../src/lib/ras")>();
  return { ...m, sendCoin: vi.fn(m.sendCoin) };
});

import { POST } from "../src/app/api/admin/withdrawals/[id]/route";
import {
  approveWithdrawal, Forbidden, markNgnPaid, rejectWithdrawal, requireAdmin, resolveStuckPaid, resolveStuckRelease, searchPayments,
} from "../src/lib/admin";
import { createCreator } from "../src/lib/creators";
import { addEntry, balance } from "../src/lib/ledger";
import { startTestDb } from "../src/lib/testing";
import { WithdrawalError } from "../src/lib/withdrawals";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string, boss: string;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: boss }] = await t.sql`insert into users (email, role) values ('boss@x.com','admin') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  sessionUser = { id: boss, email: "boss@x.com", role: "admin" };
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from withdrawals`;
  await t.sql`delete from payments`;
  await addEntry(t.sql, { creatorId: ada, kind: "credit", amountUsdt: "10", ref: "credit:1" });
});

/** A held withdrawal (hold entry written, like requestWithdrawal does). */
async function held(method: "usdt" | "ngn_bank", status = "awaiting_review", note: string | null = null) {
  const dest = method === "usdt"
    ? { kind: "usdt", network: "bep20", address: "0x" + "a".repeat(40) }
    : { kind: "bank", bankName: "GTB", accountNumber: "0123456789", accountName: "Ada" };
  const [w] = await t.sql`insert into withdrawals (creator_id, method, amount_usdt, fee_usdt, destination, status, admin_note)
    values (${ada}, ${method}, 4, 1, ${t.sql.json(dest)}, ${status}, ${note}) returning id`;
  await addEntry(t.sql, { creatorId: ada, kind: "hold", amountUsdt: "-4", ref: `hold:${w.id}` });
  return w.id as string;
}
const status = async (id: string) => (await t.sql`select * from withdrawals where id = ${id}`)[0];
const call = (id: string, body: unknown, headers: Record<string, string> = {}) =>
  POST(new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", ...headers } }), { params: Promise.resolve({ id }) });

test("non-admins are Forbidden, everywhere", async () => {
  sessionUser = { id: ada, email: "ada@x.com", role: "creator" };
  await expect(requireAdmin()).rejects.toBeInstanceOf(Forbidden);
  const id = await held("usdt");
  await expect(approveWithdrawal(ada, id)).rejects.toBeInstanceOf(Forbidden);
  await expect(rejectWithdrawal(ada, id, "no")).rejects.toBeInstanceOf(Forbidden);
  expect((await status(id)).status).toBe("awaiting_review");
  expect((await call(id, { action: "approve" })).status).toBe(403);
  sessionUser = null;
  expect((await call(id, {})).status).toBe(401);
});

test("reject restores the balance and blocks a second attempt", async () => {
  const id = await held("ngn_bank");
  expect(await balance(ada)).toBe("6.000000");
  await rejectWithdrawal(boss, id, "details look wrong");
  expect(await balance(ada)).toBe("10.000000");
  const w = await status(id);
  expect([w.status, w.admin_note]).toEqual(["rejected", "details look wrong"]);
  await expect(rejectWithdrawal(boss, id, "again")).rejects.toThrow("Not awaiting review.");
  expect(await balance(ada)).toBe("10.000000");
});

test("reject needs a note", async () => {
  const id = await held("usdt");
  await expect(rejectWithdrawal(boss, id, " ")).rejects.toBeInstanceOf(WithdrawalError);
  expect((await status(id)).status).toBe("awaiting_review");
});

test("markNgnPaid needs a bank reference, keeps the hold, writes a payout marker", async () => {
  const id = await held("ngn_bank");
  await expect(markNgnPaid(boss, id, "  ")).rejects.toBeInstanceOf(WithdrawalError);
  expect((await status(id)).status).toBe("awaiting_review");
  await markNgnPaid(boss, id, "NIP-123");
  const w = await status(id);
  expect([w.status, w.bank_reference]).toEqual(["paid", "NIP-123"]);
  expect(await balance(ada)).toBe("6.000000");
  const m = await t.sql`select amount_usdt::text a from ledger_entries where ref = ${`payout:${id}`}`;
  expect(m.map((r) => Number(r.a))).toEqual([0]);
  await expect(markNgnPaid(boss, id, "NIP-124")).rejects.toThrow("Not awaiting review.");
});

test("markNgnPaid refuses a USDT withdrawal", async () => {
  const id = await held("usdt");
  await expect(markNgnPaid(boss, id, "x")).rejects.toThrow("Not awaiting review.");
});

test("approve sends USDT once; an already-paid one gets Not awaiting review.", async () => {
  const id = await held("usdt");
  await approveWithdrawal(boss, id);
  expect((await status(id)).status).toBe("processing");
  await expect(approveWithdrawal(boss, id)).rejects.toThrow("Not awaiting review.");
  const paid = await held("usdt", "paid");
  await expect(approveWithdrawal(boss, paid)).rejects.toThrow("Not awaiting review.");
  const bank = await held("ngn_bank");
  await expect(approveWithdrawal(boss, bank)).rejects.toThrow("Not awaiting review.");
});

test("two concurrent rejects apply once", async () => {
  const id = await held("usdt");
  const r = await Promise.allSettled([rejectWithdrawal(boss, id, "a"), rejectWithdrawal(boss, id, "b")]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
  expect(await balance(ada)).toBe("10.000000");
});

test("stuck: paid keeps the hold, release returns it; both need a note and only apply to processing", async () => {
  const a = await held("usdt", "processing", "stuck alerted");
  await expect(resolveStuckPaid(boss, a, "")).rejects.toBeInstanceOf(WithdrawalError);
  await resolveStuckPaid(boss, a, "tx hash 0xabc checked");
  expect([(await status(a)).status, (await status(a)).admin_note]).toEqual(["paid", "tx hash 0xabc checked"]);
  expect(await balance(ada)).toBe("6.000000");
  await expect(resolveStuckPaid(boss, a, "n")).rejects.toThrow("Not stuck in sending.");

  const b = await held("usdt", "processing", "stuck alerted");
  expect(await balance(ada)).toBe("2.000000");
  await resolveStuckRelease(boss, b, "verified not sent");
  expect((await status(b)).status).toBe("failed");
  expect(await balance(ada)).toBe("6.000000");
  await expect(resolveStuckRelease(boss, b, "n")).rejects.toThrow("Not stuck in sending.");
  const review = await held("usdt");
  await expect(resolveStuckRelease(boss, review, "n")).rejects.toThrow("Not stuck in sending.");
});

test("route maps actions, stuck actions, and bad input", async () => {
  const n = await held("ngn_bank");
  expect((await call(n, { action: "paid", bankReference: "R1" })).status).toBe(200);
  expect((await call(n, { action: "paid", bankReference: "R2" })).status).toBe(400);
  expect((await call(n, { action: "bogus" })).status).toBe(400);
  const s = await held("usdt", "processing", "stuck alerted");
  expect((await call(s, { action: "stuck_release", note: "verified" })).status).toBe(200);
  expect((await status(s)).status).toBe("failed");
  const r = await held("usdt");
  expect((await call(r, { action: "reject", note: "nope" })).status).toBe(200);
});

test("searchPayments: exact ref, username or email, case-insensitive, injection-safe, capped at 50", async () => {
  await t.sql`insert into payments (ref, kind, creator_id, supporter_email, status) values ('REF-1','treat',${ada},'Tunde@X.com','successful')`;
  expect((await searchPayments("REF-1")).map((p) => p.ref)).toEqual(["REF-1"]);
  expect(await searchPayments("ref-1")).toHaveLength(0);
  expect(await searchPayments("ADA_BAKES")).toHaveLength(1);
  expect(await searchPayments("tunde@x.com")).toHaveLength(1);
  expect(await searchPayments("' or 1=1 --")).toHaveLength(0);
  expect(await searchPayments("   ")).toHaveLength(0);
  for (let i = 0; i < 60; i++) await t.sql`insert into payments (ref, kind, creator_id, status) values (${"B" + i},'treat',${ada},'pending')`;
  expect(await searchPayments("ada_bakes")).toHaveLength(50);
});

test("stuck actions refuse a processing row without the stuck marker", async () => {
  const id = await held("usdt", "processing");
  await expect(resolveStuckRelease(boss, id, "n")).rejects.toThrow("Not stuck in sending.");
  await expect(resolveStuckPaid(boss, id, "n")).rejects.toThrow("Not stuck in sending.");
  expect((await status(id)).status).toBe("processing");
  expect(await balance(ada)).toBe("6.000000");
});

test("route CSRF: cross-origin 403, non-JSON 415, same-origin passes", async () => {
  const id = await held("usdt");
  expect((await call(id, { action: "reject", note: "x" }, { origin: "https://evil.example" })).status).toBe(403);
  const noJson = POST(new Request("http://x", { method: "POST", body: "action=reject", headers: { "content-type": "text/plain" } }), { params: Promise.resolve({ id }) });
  expect((await noJson).status).toBe(415);
  expect((await status(id)).status).toBe("awaiting_review");
  expect((await call(id, { action: "reject", note: "x" }, { origin: "http://x" })).status).toBe(200);
});
