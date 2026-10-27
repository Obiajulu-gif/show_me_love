import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPaymentLink, requeryTx, sendStatus, networkFee, sendCoin, rasMode, webhookKey, NETWORKS } from "../src/lib/ras";
import { decryptWebhook, encryptWebhook } from "../src/lib/webhookCrypto";

beforeEach(() => {
  vi.stubEnv("RAS_MODE", "practice");
});

const customer = { email: "a@b.co", first_name: "A", last_name: "B" };

describe("ras practice mode", () => {
  it("is practice with no webhook key", () => {
    expect(rasMode()).toBe("practice");
    expect(webhookKey()).toBeNull();
  });
  it("practice payment link offers only bep20 and trc20", async () => {
    const link = await createPaymentLink({ amountNgn: "1000", reference: "r1", customer, successUrl: "http://x", cancelUrl: "http://y", metadata: {} });
    expect(link.wallets.map((w) => w.network)).toEqual(["bep20", "trc20"]);
    expect(NETWORKS.map((n) => n.network)).toEqual(["bep20", "trc20"]);
  });
  it("practice requeryTx is confirmed", async () => {
    expect(await requeryTx("bep20", "0xabc")).toEqual({ confirmed: true, message: "practice" });
  });
  it("practice sendStatus is completed", async () => {
    expect(await sendStatus("123")).toBe("completed");
  });
  it("practice send and fee", async () => {
    expect(await networkFee("trc20")).toBe(1);
    expect(await sendCoin({ token: "usdt", network: "bep20", to: "0x" + "a".repeat(40), amount: "5" })).toMatch(/^\d+$/);
  });
});

describe("webhook crypto", () => {
  const k = "k".repeat(40);
  it("webhook round-trips", () => {
    const ev = { event_id: "e1", event_type: "payment.completed", meta_data: { a: 1 } };
    const { body, iv } = encryptWebhook(ev, k);
    expect(decryptWebhook(body.hash, iv, k)).toEqual(ev);
  });
  it("garbage webhook is null", () => {
    expect(decryptWebhook("zz", "00", k)).toBeNull();
  });
});

describe("ras live paths (stubbed fetch)", () => {
  const reply = (body: unknown, status = 200) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
  beforeEach(() => {
    vi.stubEnv("RAS_MODE", "test");
    vi.stubEnv("RAS_TEST_KEY", "k".repeat(40));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("requeryTx success is confirmed", async () => {
    reply({ status: "success", data: {} });
    expect((await requeryTx("bep20", "0x1")).confirmed).toBe(true);
  });
  it("requeryTx RAS fail is not confirmed and does not throw", async () => {
    reply({ status: "fail", message: "transaction not found or still pending" }, 400);
    expect(await requeryTx("bep20", "0x1")).toEqual({ confirmed: false, message: "transaction not found or still pending" });
  });
  it("requeryTx throws on network error, auth, 5xx and missing key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    await expect(requeryTx("bep20", "0x1")).rejects.toThrow();
    reply({ status: "fail", message: "bad key" }, 401);
    await expect(requeryTx("bep20", "0x1")).rejects.toThrow();
    reply({ status: "fail", message: "oops" }, 502);
    await expect(requeryTx("bep20", "0x1")).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 502 })));
    await expect(requeryTx("bep20", "0x1")).rejects.toThrow();
    vi.stubEnv("RAS_TEST_KEY", "");
    await expect(requeryTx("bep20", "0x1")).rejects.toThrow();
  });
  it("requeryTx throws on non-JSON 200 and non-JSON 404", async () => {
    for (const status of [200, 404, 429]) {
      vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status })));
      await expect(requeryTx("bep20", "0x1")).rejects.toThrow("non-JSON");
    }
  });
  it("sendStatus maps words safely", async () => {
    for (const [st, want] of [["unsuccessful", "failed"], ["incomplete", "queued"], ["Completed", "completed"], ["failed", "failed"]] as const) {
      reply({ status: "success", data: { status: st } });
      expect(await sendStatus("1")).toBe(want);
    }
  });
  it("sendCoin throws on missing refid", async () => {
    reply({ status: "success", data: {} });
    await expect(sendCoin({ token: "usdt", network: "bep20", to: "0x" + "a".repeat(40), amount: "5" })).rejects.toThrow("no refid");
  });
});
