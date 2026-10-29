import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { activity, listUsers, platformStats, recentPayments } from "../src/lib/adminInsights";
import { createCreator } from "../src/lib/creators";
import { addEntry } from "../src/lib/ledger";
import { startTestDb } from "../src/lib/testing";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string, tobi: string;

beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email, created_at) values ('ada@x.com', now() - interval '30 days') returning id`;
  [{ id: tobi }] = await t.sql`insert into users (email) values ('tobi@x.com') returning id`;
  await t.sql`insert into users (email, role) values ('boss@x.com', 'admin')`;
  await t.sql`insert into users (email) values ('lurker@x.com')`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
  await t.sql`update creators set created_at = now() - interval '30 days' where user_id = ${ada}`;
  await createCreator(tobi, { username: "tobi_codes", treatId: "suya" });

  await t.sql`insert into payments (ref, kind, creator_id, supporter_name, supporter_email, quantity, amount_ngn, amount_usdt, received_usdt, status, completed_at)
    values ('PAYOK1', 'treat', ${ada}, 'Tunde', 'tunde@x.com', 3, 1500, 1.00, 1.00, 'successful', now() - interval '1 hour'),
           ('PAYOK2', 'treat', ${tobi}, 'Ife', 'ife@x.com', 1, 3000, 2.00, 2.50, 'successful', now() - interval '20 days'),
           ('PAYWAIT', 'treat', ${tobi}, 'Kemi', 'kemi@x.com', 1, 500, 0.33, null, 'pending', null),
           ('PAYBAD', 'treat', ${ada}, 'Chidi', 'chidi@x.com', 1, 500, 0.33, null, 'failed', null)`;
  await addEntry(t.sql, { creatorId: ada, kind: "credit", amountUsdt: "1.00", ref: "credit:PAYOK1" });
  await addEntry(t.sql, { creatorId: ada, kind: "fee", amountUsdt: "-0.05", ref: "fee:PAYOK1" });
  await addEntry(t.sql, { creatorId: tobi, kind: "credit", amountUsdt: "2.50", ref: "credit:PAYOK2" });
  await addEntry(t.sql, { creatorId: tobi, kind: "fee", amountUsdt: "-0.125", ref: "fee:PAYOK2" });
  await t.sql`insert into withdrawals (creator_id, method, amount_usdt, status) values (${tobi}, 'usdt', 1.00, 'awaiting_review'), (${ada}, 'usdt', 0.50, 'paid')`;
  await addEntry(t.sql, { creatorId: ada, kind: "payout", amountUsdt: "-0.50", ref: "payout:1" });
  await t.sql`insert into reports (username, reason) values ('tobi_codes', 'spam')`;
});
afterAll(async () => { await t.stop(); });

test("platform stats add up users, money in, fees, balances owed and open work", async () => {
  const s = await platformStats();
  expect(s.users).toMatchObject({ total: 4, new7d: 3, admins: 1 });
  expect(s.creators).toMatchObject({ total: 2, new7d: 1 });
  expect(s.payments).toMatchObject({ successful: 2, pending: 1, failed7d: 1 });
  expect(Number(s.payments.receivedUsdt)).toBeCloseTo(3.5);
  expect(Number(s.payments.received7dUsdt)).toBeCloseTo(1.0);
  expect(Number(s.feesUsdt)).toBeCloseTo(0.175);
  expect(Number(s.owedUsdt)).toBeCloseTo(1.0 - 0.05 + 2.5 - 0.125 - 0.5);
  expect(s.withdrawals).toMatchObject({ awaitingReview: 1, processing: 0 });
  expect(Number(s.withdrawals.paidUsdt)).toBeCloseTo(0.5);
  expect(s.openReports).toBe(1);
});

test("activity is one newest-first feed across signups, pages, payments, withdrawals and reports", async () => {
  const feed = await activity({ limit: 50 });
  const kinds = new Set(feed.map((e) => e.kind));
  for (const k of ["signup", "page", "payment", "withdrawal", "report"]) expect(kinds).toContain(k);
  for (let i = 1; i < feed.length; i++) expect(feed[i - 1].at.getTime()).toBeGreaterThanOrEqual(feed[i].at.getTime());
  const paid = feed.find((e) => e.kind === "payment" && e.title.includes("Tunde"));
  expect(paid).toMatchObject({ tone: "good", href: "/admin/payments?q=PAYOK1" });
  expect(feed.find((e) => e.kind === "payment" && e.title.includes("Chidi"))?.tone).toBe("bad");
  expect((await activity({ limit: 50, kind: "signup" })).every((e) => e.kind === "signup")).toBe(true);
  expect(await activity({ limit: 2 })).toHaveLength(2);
});

test("users list joins page and earnings, searches email or username, newest first", async () => {
  const all = await listUsers({});
  expect(all.total).toBe(4);
  expect(all.rows[0].email).not.toBe("ada@x.com"); // ada joined 30 days ago, so last
  const a = all.rows.find((r) => r.email === "ada@x.com")!;
  expect(a).toMatchObject({ username: "ada_bakes", treats: 1, role: "creator" });
  expect(Number(a.receivedUsdt)).toBeCloseTo(1.0);
  expect(Number(a.balanceUsdt)).toBeCloseTo(0.45);
  expect(all.rows.find((r) => r.email === "lurker@x.com")).toMatchObject({ username: null, treats: 0 });
  expect((await listUsers({ q: "tobi" })).rows.map((r) => r.email)).toEqual(["tobi@x.com"]);
  expect((await listUsers({ q: "ADA@X" })).rows.map((r) => r.email)).toEqual(["ada@x.com"]);
  const page = await listUsers({ limit: 1, offset: 1 });
  expect(page.rows).toHaveLength(1);
  expect(page.total).toBe(4);
});

test("recent payments list filters by status", async () => {
  expect((await recentPayments({})).length).toBe(4);
  expect((await recentPayments({ status: "successful" })).map((p) => p.ref).sort()).toEqual(["PAYOK1", "PAYOK2"]);
});
