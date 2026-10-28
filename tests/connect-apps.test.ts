import { createHash } from "node:crypto";

import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let sessionUser: { id: string; email: string; role: string } | null = null;
vi.mock("../src/lib/session", async (orig) => {
  const m = await orig<typeof import("../src/lib/session")>();
  return { ...m, requireUser: vi.fn(async () => { if (!sessionUser) throw new m.Unauthorized(); return sessionUser; }) };
});

import { DELETE, POST as createKeyRoute } from "../src/app/api/developers/apps/[id]/keys/route";
import { POST as createAppRoute } from "../src/app/api/developers/apps/route";
import { authenticateApp, createApp, createKey, redirectAllowed, revokeKey, updateApp } from "../src/lib/connect";
import { startTestDb } from "../src/lib/testing";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
let bola: string;
beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://sml.test");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bola }] = await t.sql`insert into users (email) values ('bola@x.com') returning id`;
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => { await t.sql`delete from apps`; sessionUser = { id: ada, email: "ada@x.com", role: "user" }; });

const uris = ["https://shop.example.com/cb"];
const mk = (userId = ada, over = {}) => createApp(userId, { name: "My shop", mode: "sandbox", redirectUris: uris, ...over });
const json = (url: string, method: string, body: unknown) =>
  new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

test("sandbox key starts with sml_test_, live with sml_live_, only a hash is stored", async () => {
  const app = await mk();
  expect(app.clientId).toMatch(/^sml_app_[0-9a-f]{16}$/);
  const k = await createKey(ada, app.id);
  expect(k.key).toMatch(/^sml_test_[A-Za-z0-9_-]{43}$/);
  expect(k.prefix).toBe(k.key.slice(0, 12));
  expect(k.last4).toBe(k.key.slice(-4));
  const [row] = await t.sql`select * from api_keys where app_id = ${app.id}`;
  expect(row.key_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(row)).not.toContain(k.key);
  const live = await mk(ada, { mode: "live" });
  expect((await createKey(ada, live.id)).key.startsWith("sml_live_")).toBe(true);
});

test("authenticateApp works, fails after revoke, and never throws on junk", async () => {
  const app = await mk();
  const { key } = await createKey(ada, app.id);
  expect((await authenticateApp(app.clientId, key))?.id).toBe(app.id);
  expect(await authenticateApp(app.clientId, key + "x")).toBeNull();
  expect(await authenticateApp("sml_app_nope", key)).toBeNull();
  expect(await authenticateApp(undefined as never, 5 as never)).toBeNull();
  expect(await authenticateApp(app.clientId, "")).toBeNull();
  const [{ id }] = await t.sql`select id from api_keys where app_id = ${app.id}`;
  await revokeKey(ada, id);
  expect(await authenticateApp(app.clientId, key)).toBeNull();
});

test("a key from another app or the wrong mode is rejected", async () => {
  const a = await mk();
  const b = await mk();
  const ka = await createKey(ada, a.id);
  expect(await authenticateApp(b.clientId, ka.key)).toBeNull();
  const forged = "sml_live_" + "A".repeat(43);
  await t.sql`insert into api_keys (app_id, prefix, last4, key_hash) values (${a.id}, ${forged.slice(0, 12)}, ${forged.slice(-4)}, ${createHash("sha256").update(forged).digest("hex")})`;
  expect(await authenticateApp(a.clientId, forged)).toBeNull();
});

test("redirectAllowed is exact string equality", async () => {
  const app = await mk();
  expect(redirectAllowed(app, "https://shop.example.com/cb")).toBe(true);
  expect(redirectAllowed(app, "https://shop.example.com/cb/")).toBe(false);
  expect(redirectAllowed(app, "https://evil.example.com/cb")).toBe(false);
  expect(redirectAllowed(app, "HTTPS://shop.example.com/cb")).toBe(false);
});

test("redirect URI and app validation", async () => {
  for (const bad of ["ftp://shop.example.com/cb", "javascript:alert(1)", "http://shop.example.com/cb", "https://x.com/cb#frag", "nonsense", "https://x.com/" + "a".repeat(300)]) {
    await expect(mk(ada, { redirectUris: [bad] })).rejects.toThrow(/./);
  }
  await expect(mk(ada, { redirectUris: ["ftp://shop.example.com/cb"] })).rejects.toThrow(/https/);
  await expect(mk(ada, { redirectUris: [] })).rejects.toThrow(/1 to 5/);
  await expect(mk(ada, { redirectUris: Array.from({ length: 6 }, (_, i) => `https://x.com/${i}`) })).rejects.toThrow(/1 to 5/);
  await expect(mk(ada, { redirectUris: "https://x.com" as never })).rejects.toThrow(/1 to 5/);
  await expect(mk(ada, { name: " ab " })).rejects.toThrow(/3 to 60/);
  await expect(mk(ada, { mode: "prod" as never })).rejects.toThrow(/Sandbox or Live/);
  const ok = await mk(ada, { name: "  Dev  ", redirectUris: ["http://localhost:3000/cb", "http://127.0.0.1/cb"] });
  expect(ok.name).toBe("Dev");
});

test("limits: 10 apps per user, 5 active keys per app", async () => {
  for (let i = 0; i < 10; i++) await mk();
  await expect(mk()).rejects.toThrow("You can have up to 10 apps.");
  await mk(bola);
  await t.sql`delete from apps where owner_id = ${ada}`;
  const app = await mk();
  for (let i = 0; i < 5; i++) await createKey(ada, app.id);
  await expect(createKey(ada, app.id)).rejects.toThrow(/5 active keys/);
  const [{ id }] = await t.sql`select id from api_keys where app_id = ${app.id} limit 1`;
  await revokeKey(ada, id);
  await createKey(ada, app.id);
});

test("everything is scoped to the owner", async () => {
  const app = await mk();
  const { key } = await createKey(ada, app.id);
  await expect(createKey(bola, app.id)).rejects.toThrow(/couldn't find/);
  await expect(updateApp(bola, app.id, { name: "Stolen" })).rejects.toThrow(/couldn't find/);
  const [{ id }] = await t.sql`select id from api_keys where app_id = ${app.id}`;
  await expect(revokeKey(bola, id)).rejects.toThrow(/couldn't find/);
  await expect(createKey(ada, "not-a-uuid")).rejects.toThrow(/couldn't find/);
  expect(await authenticateApp(app.clientId, key)).not.toBeNull();
  const up = await updateApp(ada, app.id, { redirectUris: ["https://new.example.com/cb"] });
  expect(up.redirectUris).toEqual(["https://new.example.com/cb"]);
  await expect(updateApp(ada, app.id, { redirectUris: ["ftp://x.com"] })).rejects.toThrow(/./);
});

test("routes: 401, 400 for junk, 403 cross-site, 404 for others' apps", async () => {
  const url = "https://sml.test/api/developers/apps";
  sessionUser = null;
  expect((await createAppRoute(json(url, "POST", {}))).status).toBe(401);
  sessionUser = { id: ada, email: "ada@x.com", role: "user" };
  expect((await createAppRoute(json(url, "POST", [1]))).status).toBe(400);
  expect((await createAppRoute(json(url, "POST", { name: 5, mode: {}, redirectUris: null }))).status).toBe(400);
  const cross = new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.test" }, body: "{}" });
  expect((await createAppRoute(cross)).status).toBe(403);
  const r = await createAppRoute(json(url, "POST", { name: "Route app", mode: "sandbox", redirectUris: uris }));
  expect(r.status).toBe(200);
  const { app } = await r.json();
  const kb = await (await createKeyRoute(json(url, "POST", {}), ctx(app.id))).json();
  expect(kb.key).toMatch(/^sml_test_/);
  sessionUser = { id: bola, email: "bola@x.com", role: "user" };
  expect((await createKeyRoute(json(url, "POST", {}), ctx(app.id))).status).toBe(404);
  expect((await DELETE(json(url, "DELETE", { keyId: kb.id }), ctx(app.id))).status).toBe(404);
  expect((await DELETE(json(url, "DELETE", { keyId: 7 }), ctx(app.id))).status).toBe(400);
  sessionUser = { id: ada, email: "ada@x.com", role: "user" };
  expect((await DELETE(json(url, "DELETE", { keyId: kb.id }), ctx(app.id))).status).toBe(200);
});
