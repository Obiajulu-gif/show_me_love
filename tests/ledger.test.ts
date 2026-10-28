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

test("totalReceived is net of refunds; a restored refund counts once; group credits count", async () => {
  const [u] = await t.sql`insert into users (email) values ('l2@x.com') returning id`;
  const id = u.id;
  await t.sql`insert into creators (user_id, username) values (${id}, 'ledger_two')`;
  const add = (kind: "credit" | "fee" | "reversal", amountUsdt: string, ref: string) => addEntry(t.sql, { creatorId: id, kind, amountUsdt, ref });
  await add("credit", "1", "pay:R1"); await add("fee", "-0.05", "fee:R1");
  await add("credit", "2", "pay:G1:" + id); // group credit
  expect(await totalReceived(id)).toBe("3.000000");
  await add("reversal", "-1", "rev:R1:a"); await add("reversal", "0.05", "revfee:R1:a"); // refunded
  expect(await totalReceived(id)).toBe("2.000000");
  await add("credit", "1", "recredit:R1:b"); await add("fee", "-0.05", "refee:R1:b"); // bounced and restored
  expect(await totalReceived(id)).toBe("3.000000");
});
