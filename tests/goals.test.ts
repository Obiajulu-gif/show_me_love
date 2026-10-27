import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let sessionUser: { id: string; email: string; role: string } | null = null;
vi.mock("../src/lib/session", async (orig) => {
  const m = await orig<typeof import("../src/lib/session")>();
  return { ...m, requireUser: vi.fn(async () => { if (!sessionUser) throw new m.Unauthorized(); return sessionUser; }) };
});
vi.mock("../src/lib/ras", async (orig) => ({ ...(await orig<typeof import("../src/lib/ras")>()), createPaymentLink: vi.fn() }));
vi.mock("../src/lib/rates", async (orig) => ({ ...(await orig<typeof import("../src/lib/rates")>()), getRate: vi.fn() }));

import { PATCH } from "../src/app/api/goals/[id]/route";
import { POST as create } from "../src/app/api/goals/route";
import { CheckoutBusy } from "../src/lib/checkout";
import { createCreator } from "../src/lib/creators";
import { db } from "../src/lib/db";
import { createGoal, getPublicGoal, goalProgress, setPaused, startGoalCheckout, updateGoal } from "../src/lib/goals";
import { balance } from "../src/lib/ledger";
import { handleRasEvent } from "../src/lib/payments";
import { createPaymentLink } from "../src/lib/ras";
import { getRate, RateUnavailable } from "../src/lib/rates";
import { startTestDb } from "../src/lib/testing";
import { renameUsername } from "../src/lib/usernames";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
let bola: string;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  vi.stubEnv("PUBLIC_APP_URL", "https://sml.test");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bola }] = await t.sql`insert into users (email) values ('bola@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
  await createCreator(bola, { username: "bola_b", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  vi.mocked(getRate).mockResolvedValue({ ngnPerUsd: 1500, at: new Date() });
  vi.mocked(createPaymentLink).mockResolvedValue({ refid: "r1", payment_link: null, wallets: [], expires_at: "" });
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from payments`;
  await t.sql`delete from goals`;
});

const base = { title: "Help me buy a camera", currency: "NGN" as const, target: 500000, suggested: 2000 };
const who = { name: "Tunde Bello", email: "t@x.com", message: "go", isPublic: true };

test("slug comes from the title and collisions get -2", async () => {
  const a = await createGoal(ada, base);
  const b = await createGoal(ada, base);
  expect(a.slug).toBe("help-me-buy-a-camera");
  expect(b.slug).toBe("help-me-buy-a-camera-2");
  expect(a).toMatchObject({ currency: "NGN", target: 500000, suggested: 2000, paused: false, currencyLocked: false, headerMode: "default", showProgress: true });
  // another creator may reuse the slug
  expect((await createGoal(bola, base)).slug).toBe("help-me-buy-a-camera");
  const [row] = await t.sql`select suggested from goals where id = ${a.id}`;
  expect(row.suggested).toEqual(["2000"]);
});

test("validation", async () => {
  await expect(createGoal(ada, { ...base, title: "ab" })).rejects.toThrow(/Title/);
  await expect(createGoal(ada, { ...base, title: "x".repeat(81) })).rejects.toThrow(/Title/);
  await expect(createGoal(ada, { ...base, story: "s".repeat(2001) })).rejects.toThrow(/Story/);
  await expect(createGoal(ada, { ...base, currency: "EUR" as never })).rejects.toThrow(/Currency/);
  await expect(createGoal(ada, { ...base, target: 0 })).rejects.toThrow(/Target/);
  await expect(createGoal(ada, { ...base, suggested: -1 })).rejects.toThrow(/Suggested/);
  await expect(createGoal(ada, { ...base, headerMode: "nope" as never })).rejects.toThrow(/header/i);
  await expect(createGoal(ada, { ...base, currency: "USD", target: 10.555 })).rejects.toThrow(/decimal/);
  await expect(createGoal(ada, { ...base, target: 100.5 })).rejects.toThrow(/whole/);
});

test("checkout locks the currency; a later change fails but other edits work", async () => {
  const g = await createGoal(ada, base);
  await updateGoal(ada, g.id, { currency: "USD", target: 300, suggested: 5 }); // still free
  const { ref, url } = await startGoalCheckout(g.id, 7, who);
  expect(url).toBe(`/@ada_bakes/goals/${g.slug}?ref=${ref}&thanks=1&practice=1`);
  const [p] = await t.sql`select kind, goal_id, creator_id, amount_ngn from payments where ref = ${ref}`;
  expect(p).toMatchObject({ kind: "goal", goal_id: g.id, creator_id: ada, amount_ngn: "10500" }); // 7 USD x 1500
  expect(vi.mocked(createPaymentLink).mock.calls.at(-1)![0].successUrl).toBe(`https://sml.test/@ada_bakes/goals/${g.slug}?ref=${ref}&thanks=1`);
  await expect(updateGoal(ada, g.id, { currency: "NGN" })).rejects.toThrow("Currency locks when the first checkout starts.");
  expect((await updateGoal(ada, g.id, { currency: "USD", title: "New title here" })).title).toBe("New title here");
});

test("USD amounts round up to whole naira; bad amounts and a rate outage are rejected", async () => {
  const g = await createGoal(ada, { ...base, currency: "USD", target: 100, suggested: 5 });
  vi.mocked(getRate).mockResolvedValue({ ngnPerUsd: 1523.4, at: new Date() });
  const { ref } = await startGoalCheckout(g.id, 1.25, who);
  expect((await t.sql`select amount_ngn from payments where ref = ${ref}`)[0].amount_ngn).toBe("1905"); // ceil(1904.25)
  await expect(startGoalCheckout(g.id, 0.5, who)).rejects.toThrow(/\$1/);
  await expect(startGoalCheckout(g.id, 1.234, who)).rejects.toThrow(/2 decimal/);
  vi.mocked(getRate).mockRejectedValue(new RateUnavailable("down"));
  await expect(startGoalCheckout(g.id, 5, who)).rejects.toThrow(CheckoutBusy);
  const n = await createGoal(ada, base);
  await expect(startGoalCheckout(n.id, 99, who)).rejects.toThrow(/₦100/);
  await expect(startGoalCheckout(n.id, 150.5, who)).rejects.toThrow(/whole/);
  await expect(startGoalCheckout("00000000-0000-0000-0000-000000000000", 500, who)).rejects.toThrow(/find that goal/);
});

test("a paused goal refuses checkout and resumes", async () => {
  const g = await createGoal(ada, base);
  expect((await setPaused(ada, g.id, true)).paused).toBe(true);
  await expect(startGoalCheckout(g.id, 500, who)).rejects.toThrow("This goal is paused.");
  expect((await t.sql`select count(*)::int n from payments`)[0].n).toBe(0);
  await setPaused(ada, g.id, false);
  await startGoalCheckout(g.id, 500, who);
});

test("mutations are scoped to the owner", async () => {
  const g = await createGoal(ada, base);
  await expect(updateGoal(bola, g.id, { title: "Hijacked goal" })).rejects.toThrow(/find that goal/);
  await expect(setPaused(bola, g.id, true)).rejects.toThrow(/find that goal/);
  expect(await getPublicGoal("bola_b", g.slug)).toBeNull();
  expect((await getPublicGoal("ADA_BAKES", g.slug))?.id).toBe(g.id);
});

test("progress counts only successful payments, in the goal currency", async () => {
  const g = await createGoal(ada, base);
  const ref = (await startGoalCheckout(g.id, 2000, who)).ref;
  await startGoalCheckout(g.id, 3000, who); // stays pending
  expect(await goalProgress(g.id)).toEqual({ raised: 0, count: 0 });
  await handleRasEvent({ event_id: "e1", event_type: "payment_link_completed", meta_data: { payment_reference: ref, amount_received: "1.33" } });
  expect(await goalProgress(g.id)).toEqual({ raised: 2000, count: 1 });

  const u = await createGoal(ada, { ...base, title: "Dollar goal", currency: "USD", target: 50, suggested: 5 });
  const r2 = (await startGoalCheckout(u.id, 5, who)).ref;
  await handleRasEvent({ event_id: "e2", event_type: "payment_link_overpaid", meta_data: { payment_reference: r2, amount_received: "5.10" } });
  expect(await goalProgress(u.id)).toEqual({ raised: "5.10", count: 1 });
});

test("Review Focus 5: pause + rename after checkout starts still credits the creator and counts", async () => {
  const g = await createGoal(ada, base);
  const { ref } = await startGoalCheckout(g.id, 1500, who);
  await setPaused(ada, g.id, true);
  await renameUsername(db(), ada, "ada_new");
  expect(await handleRasEvent({ event_id: "e9", event_type: "payment_link_completed", meta_data: { payment_reference: ref, amount_received: "1.00" } })).toEqual({ handled: true });
  expect(await balance(ada)).toBe("0.950000");
  expect((await goalProgress(g.id)).count).toBe(1);
  expect((await getPublicGoal("ada_new", g.slug))?.paused).toBe(true);
});

const req = (body: unknown, url = "http://localhost/api/goals/x") =>
  new Request(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const patch = (id: string, body: unknown) => PATCH(req(body), { params: Promise.resolve({ id }) });

test("PATCH edits fields; paused must be sent alone", async () => {
  sessionUser = { id: ada, email: "ada@x.com", role: "creator" };
  const g = await createGoal(ada, base);
  expect((await patch(g.id, { title: "Mixed edit", paused: true })).status).toBe(400);
  expect((await t.sql`select title, paused from goals where id = ${g.id}`)[0]).toMatchObject({ title: "Help me buy a camera", paused: false });
  expect((await patch(g.id, { paused: "yes" })).status).toBe(400);
  const ok = await patch(g.id, { title: "Edited title", slug: "ignored", raised: 5, count: 9 });
  expect(ok.status).toBe(200);
  expect((await t.sql`select title, slug from goals where id = ${g.id}`)[0]).toMatchObject({ title: "Edited title", slug: g.slug });
  expect((await patch(g.id, { paused: true })).status).toBe(200);
  expect((await t.sql`select paused from goals where id = ${g.id}`)[0].paused).toBe(true);
  expect((await patch(g.id, { showProgress: "banana" })).status).toBe(400);
  expect((await patch(g.id, { headerMode: "banana" })).status).toBe(400);
});

test("create rejects non-boolean toggles and bad headerMode with 400", async () => {
  sessionUser = { id: ada, email: "ada@x.com", role: "creator" };
  const post = (b: object) => create(new Request("http://localhost/api/goals", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...base, ...b }) }));
  expect((await post({ showProgress: "banana" })).status).toBe(400);
  expect((await post({ showTarget: 1 })).status).toBe(400);
  expect((await post({ headerMode: "banana" })).status).toBe(400);
  expect((await post({})).status).toBe(200);
  await expect(createGoal(ada, { ...base, showTarget: "x" as never })).rejects.toThrow(/Show target/);
});

test("currency locks before the checkout runs, even if the checkout then fails", async () => {
  const g = await createGoal(ada, base);
  vi.mocked(createPaymentLink).mockRejectedValue(new Error("ras down"));
  await expect(startGoalCheckout(g.id, 500, who)).rejects.toThrow(CheckoutBusy);
  expect((await t.sql`select currency_locked from goals where id = ${g.id}`)[0].currency_locked).toBe(true);
  await expect(updateGoal(ada, g.id, { currency: "USD" })).rejects.toThrow("Currency locks when the first checkout starts.");
});
