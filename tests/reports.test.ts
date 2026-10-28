import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

vi.mock("../src/lib/email", async (orig) => ({ ...(await orig<typeof import("../src/lib/email")>()), sendMail: vi.fn(async () => ({ sent: true })) }));
vi.mock("../src/lib/ras", async (orig) => {
  const m = await orig<typeof import("../src/lib/ras")>();
  return { ...m, sendCoin: vi.fn(m.sendCoin), networkFee: vi.fn(m.networkFee) };
});

import { POST as reportRoute } from "../src/app/api/reports/route";
import { listOpenReports, refundPayment, resolveReport } from "../src/lib/admin";
import { createCreator } from "../src/lib/creators";
import { sendMail } from "../src/lib/email";
import { addEntry, balance } from "../src/lib/ledger";
import * as ras from "../src/lib/ras";
import { submitReport } from "../src/lib/reports";
import { settleSendEvent } from "../src/lib/withdrawals";
import { startTestDb } from "../src/lib/testing";
import { WithdrawalError } from "../src/lib/withdrawals";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string, boss: string;
const BEP = "0x" + "b".repeat(40);

beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: boss }] = await t.sql`insert into users (email, role) values ('boss@x.com','admin') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from payments`;
  await t.sql`delete from reports`;
  await t.sql`delete from rate_limits`;
  vi.mocked(ras.sendCoin).mockClear();
  vi.mocked(sendMail).mockClear();
});

/** A successful 1.00 USDT payment: +1.00 credit, -0.05 fee -> balance 0.95. */
async function paid(ref = "p1", status = "successful") {
  await t.sql`insert into payments (ref, kind, creator_id, supporter_email, received_usdt, status)
    values (${ref}, 'treat', ${ada}, 's@x.com', 1, ${status})`;
  if (status === "successful") {
    await addEntry(t.sql, { creatorId: ada, kind: "credit", amountUsdt: "1.000000", ref: `pay:${ref}` });
    await addEntry(t.sql, { creatorId: ada, kind: "fee", amountUsdt: "-0.050000", ref: `fee:${ref}` });
  }
}
const pay = async (ref: string) => (await t.sql`select * from payments where ref = ${ref}`)[0];

test("a refund of a successful 1.00 payment brings the balance from 0.95 to 0 and sends USDT", async () => {
  await paid();
  expect(await balance(ada)).toBe("0.950000");
  expect(await refundPayment(boss, "p1", { address: BEP, network: "bep20" })).toEqual({ outcome: "sent" });
  expect(await balance(ada)).toBe("0.000000");
  const p = await pay("p1");
  expect(p).toMatchObject({ status: "refunded", refund_address: BEP, refund_network: "bep20" });
  expect(p.refund_reference).toBeTruthy();
  expect(vi.mocked(ras.sendCoin).mock.calls[0][0]).toMatchObject({ token: "usdt", network: "bep20", to: BEP, amount: "0.700000" });
});

test("only successful payments can be refunded; a second refund fails and sends nothing", async () => {
  await paid("pend", "pending");
  await expect(refundPayment(boss, "pend", { address: BEP, network: "bep20" })).rejects.toThrow("Only successful payments can be refunded.");
  await paid();
  await refundPayment(boss, "p1", { address: BEP, network: "bep20" });
  await expect(refundPayment(boss, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Only successful payments can be refunded.");
  expect(vi.mocked(ras.sendCoin)).toHaveBeenCalledTimes(1);
  expect(await balance(ada)).toBe("0.000000");
});

test("a bad address or network is refused before anything is written", async () => {
  await paid();
  await expect(refundPayment(boss, "p1", { address: "nope", network: "bep20" })).rejects.toBeInstanceOf(WithdrawalError);
  await expect(refundPayment(boss, "p1", { address: BEP, network: "eth" })).rejects.toBeInstanceOf(WithdrawalError);
  expect((await pay("p1")).status).toBe("successful");
});

test("a definite Roqqu failure restores status and balance", async () => {
  await paid();
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("insufficient merchant balance"));
  await expect(refundPayment(boss, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Roqqu refused the refund: insufficient merchant balance");
  expect(await balance(ada)).toBe("0.950000");
  expect((await pay("p1")).status).toBe("successful");
});

test("an unclear outcome keeps the refund and emails the admins", async () => {
  await paid();
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasError("Roqqu unreachable: timeout"));
  expect(await refundPayment(boss, "p1", { address: BEP, network: "bep20" })).toEqual({ outcome: "unclear" });
  expect((await pay("p1")).status).toBe("refunded");
  expect(await balance(ada)).toBe("0.000000");
  expect(vi.mocked(sendMail).mock.calls.some((c) => c[0] === "boss@x.com")).toBe(true);
});

test("a payment not larger than the network fee is refused with nothing written", async () => {
  await t.sql`insert into payments (ref, kind, creator_id, received_usdt, status) values ('tiny', 'treat', ${ada}, 0.2, 'successful')`;
  await expect(refundPayment(boss, "tiny", { address: BEP, network: "bep20" })).rejects.toThrow("Payment is too small to refund after network fees.");
  expect((await pay("tiny")).status).toBe("successful");
  expect((await t.sql`select 1 from ledger_entries where ref like 'rev%'`).length).toBe(0);
  expect(vi.mocked(ras.sendCoin)).not.toHaveBeenCalled();
});

test("non-admins cannot refund", async () => {
  await paid();
  await expect(refundPayment(ada, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Admins only.");
});

test("the report rate limit blocks the 6th report from one IP", async () => {
  for (let i = 0; i < 5; i++) await submitReport({ username: "ada_bakes", reason: "spam" }, "1.2.3.4");
  await expect(submitReport({ username: "ada_bakes", reason: "spam" }, "1.2.3.4")).rejects.toThrow("Too many reports");
  await submitReport({ username: "ada_bakes", reason: "spam" }, "5.6.7.8");
});

test("report validation, listing and resolving", async () => {
  await expect(submitReport({ username: "ada_bakes", reason: "bad" }, "ip")).rejects.toThrow("Pick a reason.");
  await expect(submitReport({ username: "ada_bakes", reason: "scam", details: "x".repeat(1001) }, "ip")).rejects.toThrow("1000");
  await expect(submitReport({ username: "ada_bakes", reason: "scam", reporterEmail: "nope" }, "ip")).rejects.toThrow("email");
  await submitReport({ username: "ada_bakes", reason: "scam", details: "pretends", reporterEmail: "r@x.com" }, "ip");
  const [r] = await listOpenReports();
  expect(r).toMatchObject({ username: "ada_bakes", reason: "scam", details: "pretends" });
  await resolveReport(boss, r.id);
  expect(await listOpenReports()).toHaveLength(0);
  await expect(resolveReport(boss, r.id)).rejects.toThrow();
});

test("the public reports route refuses cross-site posts and accepts a valid one", async () => {
  const mk = (origin?: string) => new Request("http://x/api/reports", { method: "POST", body: JSON.stringify({ username: "ada_bakes", reason: "spam" }), headers: { "content-type": "application/json", ...(origin ? { origin } : {}) } });
  expect((await reportRoute(mk("https://evil.example"))).status).toBe(403);
  expect((await reportRoute(mk())).status).toBe(200);
});

test("retry after a definite failure debits again: two sends, balance ends at 0", async () => {
  await paid();
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("insufficient merchant balance"));
  await expect(refundPayment(boss, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Roqqu refused");
  await refundPayment(boss, "p1", { address: BEP, network: "bep20" });
  expect(vi.mocked(ras.sendCoin)).toHaveBeenCalledTimes(2);
  expect(await balance(ada)).toBe("0.000000");
  expect((await pay("p1")).status).toBe("refunded");
});

test("two definite failures in a row leave the balance at 0.95", async () => {
  await paid();
  for (let i = 0; i < 2; i++) {
    vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("nope"));
    await expect(refundPayment(boss, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Roqqu refused");
  }
  expect(await balance(ada)).toBe("0.950000");
  expect((await pay("p1")).status).toBe("successful");
});

test("a bounced refund (token_refunded) restores the payment and emails admins; token_sent changes nothing", async () => {
  await paid();
  await refundPayment(boss, "p1", { address: BEP, network: "bep20" });
  const refid = (await pay("p1")).refund_reference;
  const ev = (type: string, meta: Record<string, unknown>) => ({ event_id: "e", event_type: type, meta_data: meta }) as never;
  expect(await t.sql.begin((tx) => settleSendEvent(ev("token_sent", { reference: refid }), tx))).toEqual({ handled: true });
  expect((await pay("p1")).status).toBe("refunded");
  expect(await t.sql.begin((tx) => settleSendEvent(ev("token_refunded", { refid }), tx))).toEqual({ handled: true });
  expect((await pay("p1")).status).toBe("successful");
  expect(await balance(ada)).toBe("0.950000");
  expect(vi.mocked(sendMail).mock.calls.some((c) => c[0] === "boss@x.com" && String(c[2]).includes("bounced"))).toBe(true);
  await t.sql.begin((tx) => settleSendEvent(ev("token_refunded", { refid }), tx));
  expect(await balance(ada)).toBe("0.950000");
});

test("refund sent but refund_reference save fails: admins get the refid", async () => {
  await paid();
  await t.sql.unsafe("create or replace function block_rr() returns trigger language plpgsql as 'begin if new.refund_reference is not null then raise exception ''save failed''; end if; return new; end'");
  await t.sql.unsafe("create trigger block_rr before update on payments for each row execute function block_rr()");
  try {
    expect(await refundPayment(boss, "p1", { address: BEP, network: "bep20" })).toEqual({ outcome: "unclear" });
    const refid = await vi.mocked(ras.sendCoin).mock.results[0].value;
    const c = vi.mocked(sendMail).mock.calls.at(-1)!;
    expect(c[0]).toBe("boss@x.com");
    expect(c[2]).toContain(String(refid)); expect(c[2]).toContain("p1");
  } finally { await t.sql.unsafe("drop trigger block_rr on payments"); }
});

test("a failed restore emails admins with the ref and throws a friendly error", async () => {
  await paid();
  vi.mocked(ras.sendCoin).mockRejectedValueOnce(new ras.RasFailure("nope"));
  await t.sql.unsafe("create or replace function block_recredit() returns trigger language plpgsql as 'begin if new.ref like ''recredit:%'' then raise exception ''boom''; end if; return new; end'");
  await t.sql.unsafe("create trigger block_recredit before insert on ledger_entries for each row execute function block_recredit()");
  try {
    await expect(refundPayment(boss, "p1", { address: BEP, network: "bep20" })).rejects.toThrow("Admins have been emailed");
  } finally {
    await t.sql.unsafe("drop trigger block_recredit on ledger_entries");
  }
  expect(vi.mocked(sendMail).mock.calls.some((c) => c[0] === "boss@x.com" && String(c[2]).includes("p1") && String(c[2]).includes("boom"))).toBe(true);
});
