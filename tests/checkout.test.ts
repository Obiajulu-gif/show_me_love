import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

vi.mock("../src/lib/ras", async (orig) => ({ ...(await orig<typeof import("../src/lib/ras")>()), createPaymentLink: vi.fn() }));
vi.mock("../src/lib/rates", async (orig) => ({ ...(await orig<typeof import("../src/lib/rates")>()), getRate: vi.fn() }));

import { createPaymentLink } from "../src/lib/ras";
import { getRate, RateUnavailable } from "../src/lib/rates";
import { startTestDb } from "../src/lib/testing";
import { createCreator } from "../src/lib/creators";
import { CheckoutBusy, CheckoutInvalid, newRef, paymentStatus, startCheckout } from "../src/lib/checkout";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(() => {
  vi.mocked(getRate).mockResolvedValue({ ngnPerUsd: 1500, at: new Date() });
  vi.mocked(createPaymentLink).mockResolvedValue({ refid: "r1", payment_link: null, wallets: [], expires_at: "" });
});

const input = (o: object = {}) => ({
  kind: "treat" as const, creatorId: ada, quantity: 3, amountNgn: 1500,
  supporter: { name: "Tunde Bello Jr", email: "t@x.com", message: "hi", isPublic: true }, successPath: "/@ada_bakes/thanks", ...o,
});

test("qty 3 x 500 at rate 1500 stores a locked pending row", async () => {
  const { ref, url } = await startCheckout(input());
  expect(ref).toMatch(/^[A-Z0-9]{20}$/);
  expect(url).toBe(`/@ada_bakes/thanks?ref=${ref}&practice=1`);
  const [p] = await t.sql`select * from payments where ref = ${ref}`;
  expect(p).toMatchObject({ amount_ngn: "1500", amount_usdt: "1.00", rate: "1500", status: "pending", quantity: 3, creator_id: ada });
  expect(vi.mocked(createPaymentLink).mock.calls.at(-1)![0].customer).toMatchObject({ first_name: "Tunde", last_name: "Bello Jr" });
  expect(await paymentStatus(ref)).toEqual({ status: "pending", amountNgn: 1500, creatorUsername: "ada_bakes" });
  expect(await paymentStatus("nope")).toBeNull();
});

test("bad quantity, amount or supporter is rejected", async () => {
  await expect(startCheckout(input({ quantity: 0, amountNgn: 0 }))).rejects.toThrow(CheckoutInvalid);
  await expect(startCheckout(input({ quantity: 51, amountNgn: 25500 }))).rejects.toThrow(CheckoutInvalid);
  await expect(startCheckout(input({ quantity: 3, amountNgn: 1 }))).rejects.toThrow(CheckoutInvalid);
  await expect(startCheckout(input({ quantity: undefined, amountNgn: 499 }))).rejects.toThrow(CheckoutInvalid);
  await expect(startCheckout(input({ supporter: { name: "x", email: "nope", isPublic: true } }))).rejects.toThrow(CheckoutInvalid);
  await expect(startCheckout(input({ supporter: { name: "x", email: "a@b.co", message: "m".repeat(281), isPublic: true } }))).rejects.toThrow(CheckoutInvalid);
  await startCheckout(input({ quantity: undefined, amountNgn: 700 }));
});

test("RAS failure marks the row failed and throws CheckoutBusy", async () => {
  vi.mocked(createPaymentLink).mockRejectedValue(new Error("boom"));
  await expect(startCheckout(input())).rejects.toThrow(CheckoutBusy);
  const [p] = await t.sql`select status, failure_reason from payments order by created_at desc limit 1`;
  expect(p.status).toBe("failed");
  expect(p.failure_reason).toContain("boom");
});

test("no rate throws CheckoutBusy without a row", async () => {
  vi.mocked(getRate).mockRejectedValue(new RateUnavailable("x"));
  const [{ n }] = await t.sql`select count(*)::int n from payments`;
  await expect(startCheckout(input())).rejects.toThrow("Prices are updating, try again in a minute.");
  const [{ n: m }] = await t.sql`select count(*)::int n from payments`;
  expect(m).toBe(n);
  expect(newRef()).toMatch(/^[A-Z0-9]{20}$/);
});
