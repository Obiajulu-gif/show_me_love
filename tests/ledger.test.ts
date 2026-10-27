import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestDb } from "@/lib/testing";
import { addEntry, balance, totalReceived } from "@/lib/ledger";

let t: Awaited<ReturnType<typeof startTestDb>>;
let cid: string;
beforeAll(async () => {
  t = await startTestDb();
  const [u] = await t.sql`insert into users (email) values ('l@x.com') returning id`;
  cid = u.id;
  await t.sql`insert into creators (user_id, username) values (${cid}, 'ledgerer')`;
});
afterAll(async () => { await t.stop(); });

test("balance sums signed entries, ref is idempotent, totalReceived counts credits", async () => {
  expect(await balance(cid)).toBe("0.000000");
  expect(await addEntry(t.sql, { creatorId: cid, kind: "credit", amountUsdt: "10", ref: "c1" })).toBe(true);
  await t.sql.begin(async (tx) => {
    await addEntry(tx, { creatorId: cid, kind: "fee", amountUsdt: "-0.5", ref: "f1" });
    await addEntry(tx, { creatorId: cid, kind: "hold", amountUsdt: "-3", ref: "h1" });
    expect(await balance(cid, tx)).toBe("6.500000");
  });
  expect(await balance(cid)).toBe("6.500000");
  expect(await addEntry(t.sql, { creatorId: cid, kind: "credit", amountUsdt: "10", ref: "c1" })).toBe(false);
  expect(await balance(cid)).toBe("6.500000");
  expect(await totalReceived(cid)).toBe("10.000000");
});
