import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let ip = "9.9.9.9";
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": ip }) }));
vi.mock("../src/lib/ras", async (orig) => ({ ...(await orig<typeof import("../src/lib/ras")>()), createPaymentLink: vi.fn() }));
vi.mock("../src/lib/rates", async (orig) => ({ ...(await orig<typeof import("../src/lib/rates")>()), getRate: vi.fn() }));

import { POST } from "../src/app/api/checkout/route";
import { GET } from "../src/app/api/payments/[ref]/route";
import { createPaymentLink } from "../src/lib/ras";
import { getRate } from "../src/lib/rates";
import { startTestDb } from "../src/lib/testing";
import { createCreator } from "../src/lib/creators";

let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv("RAS_MODE", "practice");
  t = await startTestDb();
  const [{ id }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(id, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });
beforeEach(() => {
  vi.mocked(getRate).mockResolvedValue({ ngnPerUsd: 1500, at: new Date() });
  vi.mocked(createPaymentLink).mockResolvedValue({ refid: "r1", payment_link: null, wallets: [], expires_at: "" });
});

const good = { username: "ada_bakes", quantity: 2, name: "Tunde", email: "t@x.com", message: "hi", isPublic: true };
const post = (body: unknown) =>
  POST(new Request("http://localhost/api/checkout", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

test("wrong types and malformed JSON give a friendly 400, never a 500", async () => {
  for (const bad of [{ ...good, name: 1 }, { ...good, email: {} }, { ...good, message: [] }, { ...good, isPublic: "yes" }, { ...good, quantity: "3" }, [], "not json{"]) {
    const r = await post(bad);
    expect(r.status).toBe(400);
    expect(typeof (await r.json()).error).toBe("string");
  }
});

test("the 11th checkout from one IP is rate limited", async () => {
  ip = "7.7.7.7";
  for (let n = 0; n < 10; n++) expect((await post(good)).status).toBe(200);
  const r = await post(good);
  expect(r.status).toBe(429);
  expect((await r.json()).error).toMatch(/too many/i);
});

test("payments GET: bad ref 404, real ref exposes only status fields", async () => {
  const bad = await GET(new Request("http://localhost/api/payments/x"), { params: Promise.resolve({ ref: "not-a-ref" }) });
  expect(bad.status).toBe(404);
  ip = "6.6.6.6";
  const made = await (await post(good)).json();
  const r = await GET(new Request("http://localhost/x"), { params: Promise.resolve({ ref: made.ref }) });
  expect(r.status).toBe(200);
  const body = await r.json();
  expect(Object.keys(body).sort()).toEqual(["amountNgn", "creatorUsername", "ok", "status"]);
  expect(JSON.stringify(body)).not.toMatch(/email|t@x\.com/i);
});
