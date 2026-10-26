import { afterAll, beforeAll, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { startTestDb } from "@/lib/testing";

let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => { t = await startTestDb(); });
afterAll(async () => { await t.stop(); });

const tables = "users creators username_history treat_catalog payments group_payments group_splits goals ledger_entries withdrawals one_time_codes apps api_keys auth_codes connections reports rate_limits webhook_events".split(" ");

test("schema applies twice and has core tables", async () => {
  await t.sql.unsafe(readFileSync(path.resolve(__dirname, "../db/schema.sql"), "utf8"));
  for (const name of tables) {
    const [r] = await t.sql`select to_regclass(${name}) as r`;
    expect(r.r, name).not.toBeNull();
  }
  const [c] = await t.sql`select count(*)::int as n from treat_catalog where parent_id is null`;
  expect(c.n).toBeGreaterThanOrEqual(10);
});
