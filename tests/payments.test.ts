import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { POST as webhook } from "../src/app/api/ras/webhook/route";
import { GET as cron } from "../src/app/api/cron/expire/route";
import { POST as simulate } from "../src/app/api/dev/simulate/route";
import { sendMail } from "../src/lib/email";
import { createCreator } from "../src/lib/creators";
import * as ledger from "../src/lib/ledger";
import { balance, totalReceived } from "../src/lib/ledger";
import { expireIfStale, expireStale, handleRasEvent } from "../src/lib/payments";
import { startTestDb } from "../src/lib/testing";
import { encryptWebhook, type RasEvent } from "../src/lib/webhookCrypto";

vi.mock("../src/lib/email", async (orig) => ({ ...(await orig<typeof import("../src/lib/email")>()), sendMail: vi.fn(async () => ({ sent: true, via: "brevo" as const })) }));
vi.mock("../src/lib/ledger", async (orig) => {
  const m = await orig<typeof import("../src/lib/ledger")>();
  return { ...m, addEntry: vi.fn(m.addEntry) };
});

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
let n = 0;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  await t.sql`delete from ledger_entries`;
  await t.sql`delete from webhook_events`;
  await t.sql`delete from payments`;
});

async function pay(minsAgo = 0, usdt = "1.00") {
  const ref = `REF${++n}`.padEnd(20, "X");
  await t.sql`insert into payments (ref, kind, creator_id, supporter_name, supporter_email, amount_ngn, amount_usdt, rate, status, created_at)
    values (${ref}, 'treat', ${ada}, 'T', 't@x.com', 1500, ${usdt}, 1500, 'pending', now() - make_interval(mins => ${minsAgo}))`;
  return ref;
}
const ev = (ref: string, type = "payment_link_completed", received: unknown = "1.00", id = `e${++n}`): RasEvent =>
  ({ event_id: id, event_type: type, meta_data: { payment_reference: ref, amount_received: received } });
const status = async (ref: string) => (await t.sql`select status from payments where ref = ${ref}`)[0].status;

test("completed credits net of fee", async () => {
  const ref = await pay();
  expect(await handleRasEvent(ev(ref))).toEqual({ handled: true });
  expect(await status(ref)).toBe("successful");
  expect(await balance(ada)).toBe("0.950000");
  expect(await totalReceived(ada)).toBe("1.000000");
});

test("overpaid credits what was received", async () => {
  const ref = await pay();
  await handleRasEvent(ev(ref, "payment_link_overpaid", "1.20"));
  expect(await totalReceived(ada)).toBe("1.200000");
  expect((await t.sql`select received_usdt from payments where ref = ${ref}`)[0].received_usdt).toBe("1.20");
});

test("duplicate event and repeated completion credit once", async () => {
  const ref = await pay();
  const e = ev(ref);
  await handleRasEvent(e);
  expect(await handleRasEvent(e)).toEqual({ handled: false, reason: "duplicate" });
  await handleRasEvent(ev(ref));
  expect(await balance(ada)).toBe("0.950000");
});

test("failed moves pending to failed, never downgrades successful", async () => {
  const a = await pay();
  await handleRasEvent(ev(a, "payment_link_failed"));
  expect(await status(a)).toBe("failed");
  expect(await balance(ada)).toBe("0.000000");
  const b = await pay();
  await handleRasEvent(ev(b));
  await handleRasEvent(ev(b, "payment_link_failed"));
  expect(await status(b)).toBe("successful");
});

test("unknown ref is not_ours", async () => {
  expect(await handleRasEvent(ev("NOPE"))).toEqual({ handled: false, reason: "not_ours" });
});

test("bad amount leaves payment pending", async () => {
  for (const bad of [null, "abc", "0", "-1"]) {
    const ref = await pay();
    expect(await handleRasEvent(ev(ref, "payment_link_completed", bad))).toEqual({ handled: false, reason: "bad_amount" });
    expect(await status(ref)).toBe("pending");
  }
  expect(await balance(ada)).toBe("0.000000");
});

test("stale pending expires, fresh stays pending", async () => {
  const old = await pay(61), fresh = await pay(59);
  await expireIfStale(old); await expireIfStale(fresh);
  expect(await status(old)).toBe("expired");
  expect(await status(fresh)).toBe("pending");
  const old2 = await pay(90);
  expect(await expireStale()).toBe(1);
  expect(await status(old2)).toBe("expired");
});

test("late money on an expired payment still credits", async () => {
  const ref = await pay(61);
  await expireIfStale(ref);
  await handleRasEvent(ev(ref));
  expect(await status(ref)).toBe("successful");
  expect(await balance(ada)).toBe("0.950000");
});

test("late or extra payment on a failed/successful row emails admins and changes no ledger", async () => {
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com");
  const failed = await pay();
  await handleRasEvent(ev(failed, "payment_link_failed"));
  vi.mocked(sendMail).mockClear();
  expect(await handleRasEvent(ev(failed, "payment_link_completed", "1.00"))).toEqual({ handled: true });
  expect(await status(failed)).toBe("failed");
  expect(await balance(ada)).toBe("0.000000");
  let c = vi.mocked(sendMail).mock.calls.at(-1)!;
  expect(c[0]).toBe("boss@x.com");
  expect(c[2]).toContain(failed); expect(c[2]).toContain("payment_link_completed"); expect(c[2]).toContain("1.00");

  const ok = await pay();
  await handleRasEvent(ev(ok));
  vi.mocked(sendMail).mockClear();
  await handleRasEvent(ev(ok, "payment_link_overpaid", "2.50"));
  expect(await balance(ada)).toBe("0.950000");
  c = vi.mocked(sendMail).mock.calls.at(-1)!;
  expect(c[2]).toContain(ok); expect(c[2]).toContain("payment_link_overpaid"); expect(c[2]).toContain("2.50");
  vi.unstubAllEnvs(); vi.stubEnv("RAS_MODE", "practice");
});

test("webhook route: bad hash 400, good hash credits, practice 404", async () => {
  vi.stubEnv("RAS_MODE", "test"); vi.stubEnv("RAS_TEST_KEY", "k".repeat(32));
  const req = (body: unknown, iv: string) => new Request("http://x/api/ras/webhook", { method: "POST", headers: { "x-api-key": iv }, body: JSON.stringify(body) });
  expect((await webhook(req({ hash: "zz" }, "00".repeat(16)))).status).toBe(400);
  const ref = await pay();
  const { body, iv } = encryptWebhook(ev(ref), "k".repeat(32));
  expect((await webhook(req(body, iv))).status).toBe(200);
  expect(await status(ref)).toBe("successful");
  const unk = encryptWebhook(ev("NOPE"), "k".repeat(32));
  expect((await webhook(req(unk.body, unk.iv))).status).toBe(200);
  vi.stubEnv("RAS_MODE", "practice");
  expect((await webhook(req(body, iv))).status).toBe(404);
});

test("cron needs the bearer secret", async () => {
  const r = (h?: string) => new Request("http://x/api/cron/expire", { headers: h ? { authorization: h } : {} });
  vi.stubEnv("CRON_SECRET", "");
  expect((await cron(r("Bearer "))).status).toBe(401);
  vi.stubEnv("CRON_SECRET", "s3");
  expect((await cron(r())).status).toBe(401);
  expect((await cron(r("Bearer nope"))).status).toBe(401);
  const ref = await pay(120);
  expect((await cron(r("Bearer s3"))).status).toBe(200);
  expect(await status(ref)).toBe("expired");
});

test("simulate: practice credits the row, other modes 404", async () => {
  const ref = await pay();
  const post = () => simulate(new Request("http://x/api/dev/simulate", { method: "POST", body: JSON.stringify({ ref }) }));
  vi.stubEnv("RAS_MODE", "test");
  expect((await post()).status).toBe(404);
  vi.stubEnv("RAS_MODE", "practice");
  expect((await post()).status).toBe(200);
  expect(await status(ref)).toBe("successful");
  expect(await balance(ada)).toBe("0.950000");
});

test("event without event_id is ignored, route answers 200", async () => {
  expect(await handleRasEvent({ ...ev("X"), event_id: undefined as unknown as string })).toEqual({ handled: false, reason: "unknown_event" });
  vi.stubEnv("RAS_MODE", "test"); vi.stubEnv("RAS_TEST_KEY", "k".repeat(32));
  const { body, iv } = encryptWebhook({ ...ev("X"), event_id: "" }, "k".repeat(32));
  const res = await webhook(new Request("http://x/api/ras/webhook", { method: "POST", headers: { "x-api-key": iv }, body: JSON.stringify(body) }));
  expect(res.status).toBe(200);
  vi.stubEnv("RAS_MODE", "practice");
});

test("ledger failure rolls back the event record; retry credits exactly once", async () => {
  const ref = await pay();
  const e = ev(ref);
  vi.mocked(ledger.addEntry).mockRejectedValueOnce(new Error("boom"));
  await expect(handleRasEvent(e)).rejects.toThrow("boom");
  expect(await t.sql`select 1 from webhook_events where event_id = ${e.event_id}`).toHaveLength(0);
  expect(await status(ref)).toBe("pending");
  expect(await handleRasEvent(e)).toEqual({ handled: true });
  expect(await balance(ada)).toBe("0.950000");
  expect(await handleRasEvent(e)).toEqual({ handled: false, reason: "duplicate" });
});
