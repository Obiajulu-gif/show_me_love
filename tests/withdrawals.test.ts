import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { GET as cron } from "../src/app/api/cron/expire/route";
import { createCreator } from "../src/lib/creators";
import { issueCode } from "../src/lib/codes";
import { addEntry, balance } from "../src/lib/ledger";
import { handleRasEvent } from "../src/lib/payments";
import { sendMail } from "../src/lib/email";
import * as ras from "../src/lib/ras";
import { startTestDb } from "../src/lib/testing";
import { approveWithdrawal } from "../src/lib/admin";
import { dispatchUsdt, pollProcessing, quoteWithdrawal, requestWithdrawal, setDestination } from "../src/lib/withdrawals";

vi.mock("../src/lib/ras", async (orig) => {
  const m = await orig<typeof import("../src/lib/ras")>();
  return { ...m, sendCoin: vi.fn(m.sendCoin), networkFee: vi.fn(m.networkFee) };
});
vi.mock("../src/lib/email", async (orig) => {
  const m = await orig<typeof import("../src/lib/email")>();
  return { ...m, sendMail: vi.fn(m.sendMail) };
});
vi.mock("../src/lib/rates", async (orig) => {
  const m = await orig<typeof import("../src/lib/rates")>();
  return { ...m, getRate: vi.fn(async () => ({ ngnPerUsd: 1500, at: new Date() })) };
});

const BEP = "0x" + "a".repeat(40);
let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from withdrawals`;
  await t.sql`delete from webhook_events`;
  await t.sql`delete from rate_limits`;
  await t.sql`update users set created_at = now() - interval '2 days' where id = ${ada}`;
  await t.sql`update creators set bank = null, payout_address = null, payout_network = null where user_id = ${ada}`;
  await setDestination(ada, { kind: "usdt", network: "bep20", address: BEP });
  await addEntry(t.sql, { creatorId: ada, kind: "credit", amountUsdt: "10", ref: `c:${Math.random()}` });
  vi.mocked(ras.sendCoin).mockClear();
  vi.mocked(sendMail).mockClear();
});
const ask = async (amount: string, method: "usdt" | "ngn_bank" = "usdt") =>
  requestWithdrawal(ada, { method, amountUsdt: amount, code: await issueCode(ada, "withdrawal", 10) });
const bank = () => setDestination(ada, { kind: "bank", bankName: "GTBank", accountNumber: "0123456789", accountName: "Ada Obi" });

test("usdt withdrawal goes processing, then paid after poll; balance debited once", async () => {
  const w = await ask("4");
  expect(w.status).toBe("processing");
  expect(w.ras_reference).toBeTruthy();
  expect(w.fee_usdt).toBe("0.300000");
  expect(vi.mocked(ras.sendCoin).mock.calls[0][0]).toMatchObject({ amount: "3.700000", to: BEP });
  expect(await pollProcessing()).toBe(0); // younger than 2 minutes
  await t.sql`update withdrawals set updated_at = now() - interval '3 minutes'`;
  expect(await pollProcessing()).toBe(1);
  expect((await t.sql`select status from withdrawals`)[0].status).toBe("paid");
  expect(await balance(ada)).toBe("6.000000");
  expect((await t.sql`select amount_usdt from ledger_entries where ref like 'payout:%'`)[0].amount_usdt).toBe("0");
});

test("account under 24h waits for review and does not send", async () => {
  await t.sql`update users set created_at = now() - interval '1 hour' where id = ${ada}`;
  const w = await ask("4");
  expect(w.status).toBe("awaiting_review");
  expect(ras.sendCoin).not.toHaveBeenCalled();
  expect(await balance(ada)).toBe("6.000000");
  await dispatchUsdt(w.id);
  expect((await t.sql`select status from withdrawals`)[0].status).toBe("processing");
  await dispatchUsdt(w.id); // second dispatch is a no-op
  expect(ras.sendCoin).toHaveBeenCalledTimes(1);
});

test("ngn_bank is always reviewed, fee is NGN_PAYOUT_FEE / rate", async () => {
  await bank();
  const q = await quoteWithdrawal(ada, "ngn_bank", "10");
  expect(q.feeUsdt).toBe("0.033334");
  expect(q.receivesNgn).toBe(14_949);
  const w = await ask("4", "ngn_bank");
  expect(w.status).toBe("awaiting_review");
  expect(w.destination).toMatchObject({ kind: "bank", accountNumber: "0123456789" });
  expect(ras.sendCoin).not.toHaveBeenCalled();
});

test("a reused or wrong code is rejected", async () => {
  const code = await issueCode(ada, "withdrawal", 10);
  await requestWithdrawal(ada, { method: "usdt", amountUsdt: "1", code });
  await expect(requestWithdrawal(ada, { method: "usdt", amountUsdt: "1", code })).rejects.toThrow("That code is wrong or expired.");
});

test("code guesses are limited to 5 per 15 minutes", async () => {
  for (let i = 0; i < 5; i++) await expect(requestWithdrawal(ada, { method: "usdt", amountUsdt: "1", code: "000000" })).rejects.toThrow("wrong or expired");
  await expect(ask("1")).rejects.toThrow("Too many attempts. Try again in 15 minutes.");
});

test("Review Focus #1: two parallel 8s against 10 -> exactly one succeeds", async () => {
  const [a, b] = await Promise.allSettled([ask("8"), ask("8")]);
  expect([a.status, b.status].sort()).toEqual(["fulfilled", "rejected"]);
  const lost = (a.status === "rejected" ? a : b) as PromiseRejectedResult;
  expect(lost.reason.message).toBe("Insufficient balance.");
  expect(await balance(ada)).toBe("2.000000");
  expect((await t.sql`select count(*)::int as n from withdrawals`)[0].n).toBe(1);
});

test("the creator row is locked before the balance is read", async () => {
  const src = (await import("node:fs")).readFileSync("src/lib/withdrawals.ts", "utf8");
  const lock = src.indexOf("from creators where user_id = ${userId} for update");
  expect(lock).toBeGreaterThan(0);
  expect(lock).toBeLessThan(src.indexOf("balance(userId, tx)"));
});

const release = async () => (await t.sql`select count(*)::int as n from ledger_entries where kind = 'release'`)[0].n;
const wstatus = async () => (await t.sql`select status, admin_note from withdrawals`)[0];

test("a definite RAS rejection (RasFailure) fails the withdrawal and releases the hold", async () => {
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("insufficient merchant balance"));
  const w = await ask("4");
  expect(w.status).toBe("failed");
  expect(await balance(ada)).toBe("10.000000");
  expect((await t.sql`select ref from ledger_entries where kind = 'release'`)[0].ref).toBe(`release:${w.id}`);
  expect(vi.mocked(sendMail).mock.calls.some((c) => c[0] === "boss@x.com")).toBe(true);
  vi.unstubAllEnvs(); vi.stubEnv("RAS_MODE", "practice");
});

test("a config error thrown before any network call also releases", async () => {
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasConfigError("RAS_LIVE_KEY is not set"));
  expect((await ask("4")).status).toBe("failed");
  expect(await balance(ada)).toBe("10.000000");
});

test("an unclear failure (unreachable / 5xx) keeps the hold, stays processing, alerts admins", async () => {
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasError("Roqqu unreachable: timeout"));
  const w = await ask("4");
  expect(w.status).toBe("processing");
  expect(await release()).toBe(0);
  expect(await balance(ada)).toBe("6.000000");
  expect((await wstatus()).admin_note).toBe("stuck alerted");
  expect(vi.mocked(sendMail).mock.calls.some((c) => c[0] === "boss@x.com")).toBe(true);
  vi.unstubAllEnvs(); vi.stubEnv("RAS_MODE", "practice");
});

test("send succeeded but saving the reference throws: hold is NOT released", async () => {
  await t.sql`create or replace function block_ref() returns trigger as $$ begin
    if new.ras_reference is not null then raise exception 'save failed'; end if; return new; end $$ language plpgsql`;
  await t.sql`create trigger block_ref before update on withdrawals for each row execute function block_ref()`;
  try {
    const w = await ask("4");
    expect(w.status).toBe("processing");
    expect(ras.sendCoin).toHaveBeenCalledTimes(1);
    expect(await release()).toBe(0);
    expect(await balance(ada)).toBe("6.000000");
  } finally { await t.sql`drop trigger block_ref on withdrawals`; }
});

test("pollProcessing alerts admins once about a processing row with no reference for over 10 minutes", async () => {
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  await t.sql`update users set created_at = now() - interval '1 hour' where id = ${ada}`;
  const w = await ask("4");
  await t.sql`update withdrawals set status = 'processing', updated_at = now() - interval '5 minutes' where id = ${w.id}`;
  await pollProcessing();
  expect(sendMail).not.toHaveBeenCalled();
  await t.sql`update withdrawals set updated_at = now() - interval '11 minutes'`;
  await pollProcessing();
  expect(sendMail).toHaveBeenCalledTimes(1);
  await pollProcessing();
  expect(sendMail).toHaveBeenCalledTimes(1);
  expect((await wstatus()).admin_note).toBe("stuck alerted");
  vi.unstubAllEnvs(); vi.stubEnv("RAS_MODE", "practice");
});

test("a refused withdrawal does not burn the code", async () => {
  const code = await issueCode(ada, "withdrawal", 10);
  await expect(requestWithdrawal(ada, { method: "usdt", amountUsdt: "11", code })).rejects.toThrow("Insufficient balance.");
  expect((await requestWithdrawal(ada, { method: "usdt", amountUsdt: "5", code })).status).toBe("processing");
});

test("setDestination emails the owner the masked new destination", async () => {
  await setDestination(ada, { kind: "usdt", network: "trc20", address: "TABCDEFGHJKLMNPQRSTUVWXYZabcdefghi" });
  const c = vi.mocked(sendMail).mock.calls.at(-1)!;
  expect(c[0]).toBe("ada@x.com");
  expect(c[2]).toContain("TRC20 TABCDE…fghi");
  expect(c[2]).not.toContain("TABCDEFGHJKLMNPQRSTUVWXYZabcdefghi");
  await bank();
  expect(vi.mocked(sendMail).mock.calls.at(-1)![2]).toContain("GTBank ••6789");
  vi.mocked(sendMail).mockRejectedValueOnce(new Error("smtp down"));
  await setDestination(ada, { kind: "usdt", network: "bep20", address: BEP }); // must not throw
});

test("fee is refused when the network changes between quote and lock", async () => {
  vi.mocked(ras.networkFee).mockImplementationOnce(async () => {
    await setDestination(ada, { kind: "usdt", network: "trc20", address: "T" + "A".repeat(33) });
    return 0.3;
  });
  await expect(ask("4")).rejects.toThrow("Your payout destination changed. Check the amount and try again.");
  expect(await balance(ada)).toBe("10.000000");
  expect((await t.sql`select count(*)::int as n from withdrawals`)[0].n).toBe(0);
});

test("daily cap: 501 is refused, the limit counts today's earlier withdrawals", async () => {
  await addEntry(t.sql, { creatorId: ada, kind: "credit", amountUsdt: "1000", ref: "big" });
  await expect(ask("501")).rejects.toThrow("Daily limit reached. Try again tomorrow.");
  await ask("300");
  await expect(ask("201")).rejects.toThrow("Daily limit reached");
  await ask("200");
});

test("insufficient balance, bad amounts, tiny amounts, missing destination, bad addresses", async () => {
  await expect(ask("10.000001")).rejects.toThrow("Insufficient balance.");
  await expect(ask("-1")).rejects.toThrow("valid amount");
  await expect(ask("1e3")).rejects.toThrow("valid amount");
  await expect(ask("0.1234567")).rejects.toThrow("valid amount");
  await expect(ask("0.3")).rejects.toThrow("Amount is too small to cover the fee.");
  await expect(ask("1", "ngn_bank")).rejects.toThrow("Add a payout destination first.");
  await expect(setDestination(ada, { kind: "usdt", network: "bep20", address: "0x123" })).rejects.toThrow();
  await expect(setDestination(ada, { kind: "usdt", network: "trc20", address: BEP })).rejects.toThrow();
  await setDestination(ada, { kind: "usdt", network: "trc20", address: "T" + "A".repeat(33) });
  await expect(setDestination(ada, { kind: "bank", bankName: "GT", accountNumber: "123", accountName: "Ada" })).rejects.toThrow("10 digits");
});

test("token_sent pays, token_refunded releases; only from processing; unknown ref is not_ours", async () => {
  const w = await ask("4");
  const ref = w.ras_reference!;
  expect(await handleRasEvent({ event_id: "s0", event_type: "token_sent", meta_data: { reference: "nope" } })).toEqual({ handled: false, reason: "not_ours" });
  expect(await handleRasEvent({ event_id: "s1", event_type: "token_sent", meta_data: { reference: ref, status: "processed" } })).toEqual({ handled: true });
  expect((await t.sql`select status from withdrawals`)[0].status).toBe("paid");
  await handleRasEvent({ event_id: "s2", event_type: "token_refunded", meta_data: { refid: ref } }); // too late: ignored
  expect((await t.sql`select status from withdrawals`)[0].status).toBe("paid");
  expect(await balance(ada)).toBe("6.000000");

  const w2 = await ask("2");
  await handleRasEvent({ event_id: "s3", event_type: "token_refunded", meta_data: { refid: w2.ras_reference } });
  expect((await t.sql`select status from withdrawals where id = ${w2.id}`)[0].status).toBe("failed");
  expect(await balance(ada)).toBe("6.000000"); // 10 - 4 (paid) ; the 2 is released
  expect(await handleRasEvent({ event_id: "s4", event_type: "token_received", meta_data: {} })).toEqual({ handled: false, reason: "unknown_event" });
});

test("token_refunded after paid changes nothing but emails admins with the id and reference", async () => {
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  const w = await ask("4");
  await handleRasEvent({ event_id: "p1", event_type: "token_sent", meta_data: { reference: w.ras_reference } });
  vi.mocked(sendMail).mockClear();
  await handleRasEvent({ event_id: "p2", event_type: "token_refunded", meta_data: { refid: w.ras_reference } });
  expect(await balance(ada)).toBe("6.000000");
  const c = vi.mocked(sendMail).mock.calls.at(-1)!;
  expect(c[0]).toBe("boss@x.com");
  expect(c[2]).toContain(w.id); expect(c[2]).toContain(String(w.ras_reference));
  vi.unstubAllEnvs(); vi.stubEnv("RAS_MODE", "practice");
});

test("admin approve reports the real outcome: failed, or sent-but-unclear", async () => {
  const [boss] = await t.sql`insert into users (email, role) values ('boss2@x.com','admin') on conflict (email) do update set role = 'admin' returning id`;
  await t.sql`update users set created_at = now() - interval '1 hour' where id = ${ada}`;
  const w1 = await ask("2");
  expect(w1.status).toBe("awaiting_review");
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("insufficient merchant balance"));
  expect(await approveWithdrawal(boss.id, w1.id)).toEqual({ status: "failed", stuck: false });
  const w2 = await ask("2");
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasError("Roqqu unreachable: timeout"));
  expect(await approveWithdrawal(boss.id, w2.id)).toEqual({ status: "processing", stuck: true });
  const w3 = await ask("2");
  expect(await approveWithdrawal(boss.id, w3.id)).toEqual({ status: "processing", stuck: false });
});

test("cron settles processing withdrawals", async () => {
  vi.stubEnv("CRON_SECRET", "s");
  await ask("4");
  await t.sql`update withdrawals set updated_at = now() - interval '5 minutes'`;
  const r = await cron(new Request("http://x/api/cron/expire", { headers: { authorization: "Bearer s" } }));
  expect((await r.json()).settled).toBe(1);
});
