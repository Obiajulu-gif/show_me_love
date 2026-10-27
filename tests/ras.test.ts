import { describe, it, expect, vi, beforeEach } from "vitest";
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
