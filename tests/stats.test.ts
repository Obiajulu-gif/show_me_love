import { afterAll, beforeAll, expect, test, vi } from "vitest";

import { createCreator } from "../src/lib/creators";
import { overview, listPayments } from "../src/lib/stats";
import { startTestDb } from "../src/lib/testing";

const rate = vi.hoisted(() => ({ fail: false }));
vi.mock("../src/lib/rates", async (orig) => {
  const m = await orig<typeof import("../src/lib/rates")>();
  return { ...m, getRate: async () => { if (rate.fail) throw new m.RateUnavailable("x"); return { ngnPerUsd: 1500, at: new Date() }; } };
});

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
  let i = 0;
  for (const s of ["successful", "pending", "failed"]) {
    await t.sql`insert into payments (ref, kind, creator_id, supporter_name, amount_ngn, amount_usdt, rate, status, created_at)
      values (${`R${++i}`.padEnd(20, "X")}, 'treat', ${ada}, 'T', 1500, '1.00', 1500, ${s}, now() - make_interval(mins => ${i}))`;
  }
  await t.sql`insert into ledger_entries (creator_id, kind, amount_usdt, ref) values (${ada}, 'credit', '0.95', 'c1')`;
});
afterAll(async () => { await t.stop(); });

test("overview counts successful treats, balance, setup, recent", async () => {
  const o = await overview(ada);
  expect(o.treatCount).toBe(1);
  expect(o.totalReceivedUsdt).toBeDefined();
  expect(o.balanceUsdt).toBe("0.950000");
  expect(o.ngnPerUsd).toBe(1500);
  expect(o.setup).toEqual({ page: true, photoBio: false, birthday: false });
  expect(o.recent.map((r) => r.status)).toEqual(["successful"]);
});

test("overview still works without a rate", async () => {
  rate.fail = true;
  expect((await overview(ada)).ngnPerUsd).toBeNull();
  rate.fail = false;
});

test("listPayments filters and paginates", async () => {
  expect((await listPayments(ada, "all")).count).toBe(3);
  expect((await listPayments(ada, "successful")).count).toBe(1);
  const p = await listPayments(ada, "pending");
  expect(p.rows[0].status).toBe("pending");
  expect(p.rows[0].viaGroup).toBe(false);
  expect((await listPayments(ada, "failed")).rows[0].status).toBe("failed");
  expect((await listPayments(ada, "all", 2)).rows).toHaveLength(0);
});
