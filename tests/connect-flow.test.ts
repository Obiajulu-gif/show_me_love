import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

let sessionUser: { id: string; email: string; role: string } | null = null;
vi.mock("../src/lib/session", async (orig) => {
  const m = await orig<typeof import("../src/lib/session")>();
  return { ...m, setSessionCookie: vi.fn(async () => {}), requireUser: vi.fn(async () => { if (!sessionUser) throw new m.Unauthorized(); return sessionUser; }) };
});

import { POST as authorizeRoute } from "../src/app/api/connect/authorize/route";
import { GET as connectionRoute } from "../src/app/api/connect/connection/route";
import { POST as disconnectRoute } from "../src/app/api/connect/disconnect/route";
import { GET as earningsRoute } from "../src/app/api/connect/earnings/route";
import { POST as sessionsRoute } from "../src/app/api/connect/sessions/route";
import { POST as tokenRoute } from "../src/app/api/connect/token/route";
import { POST as revokeRoute } from "../src/app/api/connect/revoke/route";
import {
  approve, createApp, createKey, createSession, deny, disconnect, exchangeCode, Forbidden, getConnection, getEarnings,
  listConnectedApps, revokeByCreator, type App,
} from "../src/lib/connect";
import { createCreator } from "../src/lib/creators";
import { safeNext } from "../src/lib/safeNext";
import { startTestDb } from "../src/lib/testing";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
let bola: string;
let sandbox: App;
let live: App;
const CB = "https://shop.example.com/cb";
beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://sml.test");
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bola }] = await t.sql`insert into users (email) values ('bola@x.com') returning id`;
  await createCreator(ada, { username: "ada", treatId: "coffee" });
});
afterAll(async () => { await t.stop(); });
beforeEach(async () => {
  await t.sql`delete from apps`;
  await t.sql`delete from rate_limits`;
  sessionUser = { id: ada, email: "ada@x.com", role: "user" };
  sandbox = await createApp(bola, { name: "Sandbox shop", mode: "sandbox", redirectUris: [CB] });
  live = await createApp(bola, { name: "Live shop", mode: "live", redirectUris: [CB] });
});

const reqOf = (url: string) => new URL(url).searchParams.get("req")!;
async function connect(app: App, earnings = false, userRef = "u1") {
  const url = await createSession(app, { userRef, redirectUri: CB, state: "xyz" });
  const redirect = new URL(await approve(ada, reqOf(url), { earnings }));
  return { code: redirect.searchParams.get("code")!, redirect };
}

test("full flow: session, approve, exchange, connection, earnings forbidden", async () => {
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "xyz" });
  expect(url.startsWith("https://sml.test/connect/authorize?req=")).toBe(true);
  const { code, redirect } = await connect(sandbox);
  expect(redirect.origin + redirect.pathname).toBe(CB);
  expect(redirect.searchParams.get("state")).toBe("xyz");
  expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const [row] = await t.sql`select * from auth_codes`;
  expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(JSON.stringify(row)).not.toContain(code);
  expect(await getConnection(sandbox, "u1")).toBeNull();
  expect(await exchangeCode(sandbox, code)).toEqual({ connected: true });
  const c = await getConnection(sandbox, "u1");
  expect(c?.support_url).toBe("https://sml.test/@ada");
  expect(c).toMatchObject({ username: "ada", earnings_shared: false });
  await expect(getEarnings(sandbox, "u1")).rejects.toBeInstanceOf(Forbidden);
  expect(await getConnection(sandbox, "nobody")).toBeNull();
});

test("a code works once, only for its own app, and not after expiry", async () => {
  const { code } = await connect(sandbox);
  await expect(exchangeCode(live, code)).rejects.toThrow("Code is invalid or expired.");
  await exchangeCode(sandbox, code);
  await expect(exchangeCode(sandbox, code)).rejects.toThrow("Code is invalid or expired.");
  const { code: c2 } = await connect(sandbox, false, "u2");
  await t.sql`update auth_codes set expires_at = now() - interval '1 second'`;
  await expect(exchangeCode(sandbox, c2)).rejects.toThrow("Code is invalid or expired.");
  await expect(exchangeCode(sandbox, "")).rejects.toThrow("Code is invalid or expired.");
});

test("concurrent exchanges of one code: exactly one wins", async () => {
  const { code } = await connect(sandbox);
  const r = await Promise.allSettled([exchangeCode(sandbox, code), exchangeCode(sandbox, code)]);
  expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
});

test("deny returns access_denied with the original state", async () => {
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "a b&c" });
  const u = new URL(await deny(reqOf(url)));
  expect(u.searchParams.get("error")).toBe("access_denied");
  expect(u.searchParams.get("state")).toBe("a b&c");
  expect(u.searchParams.get("code")).toBeNull();
});

test("an unregistered redirect, bad user_ref or long state is refused", async () => {
  await expect(createSession(sandbox, { userRef: "u1", redirectUri: "https://evil.example.com/cb", state: "s" })).rejects.toThrow();
  await expect(createSession(sandbox, { userRef: "u1", redirectUri: CB + "/", state: "s" })).rejects.toThrow();
  await expect(createSession(sandbox, { userRef: "", redirectUri: CB, state: "s" })).rejects.toThrow();
  await expect(createSession(sandbox, { userRef: "x".repeat(129), redirectUri: CB, state: "s" })).rejects.toThrow();
  await expect(createSession(sandbox, { userRef: "u", redirectUri: CB, state: "s".repeat(257) })).rejects.toThrow();
});

test("a forged, wrong-audience or expired request token is refused; a removed redirect is re-checked at approval", async () => {
  const { SignJWT } = await import("jose");
  const { connectKey } = await import("../src/lib/connect");
  const secret = connectKey;
  const claims = { appId: sandbox.id, userRef: "u1", redirectUri: CB, state: "s" };
  const noAud = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret());
  const expired = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setAudience("sml-connect").setExpirationTime(Math.floor(Date.now() / 1000) - 5).sign(secret());
  const wrongKey = await new SignJWT(claims).setProtectedHeader({ alg: "HS256" }).setAudience("sml-connect").setExpirationTime("10m").sign(new TextEncoder().encode("x".repeat(40)));
  for (const bad of [noAud, expired, wrongKey, "garbage", "a.b.c"]) await expect(approve(ada, bad, { earnings: false })).rejects.toThrow();
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "s" });
  await t.sql`update apps set redirect_uris = ${["https://other.example.com/cb"]}::text[] where id = ${sandbox.id}`;
  await expect(approve(ada, reqOf(url), { earnings: false })).rejects.toThrow();
  await expect(deny(reqOf(url))).rejects.toThrow();
});

test("a user without a creator page cannot approve", async () => {
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "s" });
  await expect(approve(bola, reqOf(url), { earnings: false })).rejects.toThrow();
});

test("revokeByCreator hides the connection; reconnecting clears the revocation", async () => {
  await exchangeCode(sandbox, (await connect(sandbox)).code);
  expect((await listConnectedApps(ada)).map((a) => a.name)).toEqual(["Sandbox shop"]);
  await revokeByCreator(ada, sandbox.id);
  expect(await getConnection(sandbox, "u1")).toBeNull();
  expect(await listConnectedApps(ada)).toEqual([]);
  await exchangeCode(sandbox, (await connect(sandbox, true)).code);
  expect((await getConnection(sandbox, "u1"))?.earnings_shared).toBe(true);
  await disconnect(sandbox, "u1");
  expect(await getConnection(sandbox, "u1")).toBeNull();
  await exchangeCode(sandbox, (await connect(sandbox, false)).code);
  await revokeByCreator(bola, sandbox.id); // another user's call changes nothing for ada
  expect(await getConnection(sandbox, "u1")).not.toBeNull();
});

test("sandbox earnings are the fixed fake; live earnings are real", async () => {
  await exchangeCode(sandbox, (await connect(sandbox, true)).code);
  expect(await getEarnings(sandbox, "u1")).toEqual({ total_received: "12.50", currency: "USDT", treats: 5 });
  await exchangeCode(live, (await connect(live, true)).code);
  expect(await getEarnings(live, "u1")).toEqual({ total_received: "0.000000", currency: "USDT", treats: 0 });
  expect(await getEarnings(live, "unknown")).toBeNull();
});

// ---- HTTP ----
const json = (url: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
async function auth(app: App) {
  const k = await createKey(bola, app.id);
  return { authorization: `Bearer ${k.key}`, "x-client-id": app.clientId };
}

test("HTTP API: auth, session, token, connection, earnings, disconnect", async () => {
  const h = await auth(sandbox);
  const bad = await sessionsRoute(json("https://sml.test/api/connect/sessions", "POST", { user_ref: "u1", redirect_uri: CB }, { ...h, authorization: "Bearer nope_nope_nope" }));
  expect(bad.status).toBe(401);
  expect(await bad.json()).toEqual({ error: "Invalid client credentials." });
  expect((await sessionsRoute(json("https://sml.test/api/connect/sessions", "POST", { user_ref: "u1", redirect_uri: CB }))).status).toBe(401);

  const s = await sessionsRoute(json("https://sml.test/api/connect/sessions", "POST", { user_ref: "u1", redirect_uri: CB, state: "q" }, h));
  expect(s.status).toBe(200);
  const { authorize_url } = await s.json();
  const code = new URL(await approve(ada, reqOf(authorize_url), { earnings: true })).searchParams.get("code")!;

  const text = new Request("https://sml.test/api/connect/token", { method: "POST", headers: { ...h, "content-type": "text/plain" }, body: "{}" });
  expect((await tokenRoute(text)).status).toBe(415);
  expect((await tokenRoute(json("https://sml.test/api/connect/token", "POST", { code: 5 }, h))).status).toBe(400);
  expect((await tokenRoute(json("https://sml.test/api/connect/token", "POST", { code: "nope" }, h))).status).toBe(400);
  const tk = await tokenRoute(json("https://sml.test/api/connect/token", "POST", { code }, h));
  expect(await tk.json()).toEqual({ connected: true });

  const g = (path: string) => new Request(`https://sml.test/api/connect/${path}`, { headers: h });
  const c = await connectionRoute(g("connection?user_ref=u1"));
  expect(c.status).toBe(200);
  expect(await c.json()).toMatchObject({ username: "ada", support_url: "https://sml.test/@ada", earnings_shared: true });
  expect((await connectionRoute(g("connection?user_ref=zzz"))).status).toBe(404);
  expect((await connectionRoute(g("connection"))).status).toBe(400);
  expect(await (await earningsRoute(g("earnings?user_ref=u1"))).json()).toEqual({ total_received: "12.50", currency: "USDT", treats: 5 });
  expect((await earningsRoute(g("earnings?user_ref=zzz"))).status).toBe(404);

  expect((await disconnectRoute(json("https://sml.test/api/connect/disconnect", "POST", { user_ref: 7 }, h))).status).toBe(400);
  expect((await disconnectRoute(json("https://sml.test/api/connect/disconnect", "POST", { user_ref: "u1" }, h))).status).toBe(200);
  expect((await connectionRoute(g("connection?user_ref=u1"))).status).toBe(404);
});

test("HTTP API: earnings not shared is 403, a key of another app is 401, rate limit is 429 after 120", async () => {
  await exchangeCode(sandbox, (await connect(sandbox, false)).code);
  const h = await auth(sandbox);
  const r = await earningsRoute(new Request("https://sml.test/api/connect/earnings?user_ref=u1", { headers: h }));
  expect(r.status).toBe(403);
  expect(await r.json()).toEqual({ error: "Earnings not shared." });
  const other = { ...(await auth(live)), "x-client-id": sandbox.clientId };
  expect((await earningsRoute(new Request("https://sml.test/api/connect/earnings?user_ref=u1", { headers: other }))).status).toBe(401);
  await t.sql`delete from rate_limits`;
  let last = 200;
  for (let i = 0; i < 121; i++) last = (await connectionRoute(new Request("https://sml.test/api/connect/connection?user_ref=u1", { headers: h }))).status;
  expect(last).toBe(429);
});

test("browser authorize route: needs login, same-site JSON, strict body, returns redirect", async () => {
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "s" });
  const post = (body: unknown, headers: Record<string, string> = {}) => authorizeRoute(json("https://sml.test/api/connect/authorize", "POST", body, headers));
  sessionUser = null;
  expect((await post({ req: reqOf(url), decision: "deny" })).status).toBe(401);
  sessionUser = { id: ada, email: "ada@x.com", role: "user" };
  expect((await post({ req: reqOf(url), decision: "deny" }, { origin: "https://evil.example" })).status).toBe(403);
  expect((await post({ req: reqOf(url), decision: "maybe" })).status).toBe(400);
  expect((await post({ req: 5, decision: "allow" })).status).toBe(400);
  expect((await post({ req: "junk", decision: "allow" })).status).toBe(400);
  expect((await post(null)).status).toBe(400);
  expect((await post({ req: reqOf(url), decision: "allow", earnings: "yes" })).status).toBe(400);
  const d = await (await post({ req: reqOf(url), decision: "deny" })).json();
  expect(new URL(d.redirect).searchParams.get("error")).toBe("access_denied");
  const a = await (await post({ req: reqOf(url), decision: "allow", earnings: true }, { origin: "https://sml.test" })).json();
  const code = new URL(a.redirect).searchParams.get("code")!;
  await exchangeCode(sandbox, code);
  expect((await getConnection(sandbox, "u1"))?.earnings_shared).toBe(true);
});

test("browser revoke route", async () => {
  await exchangeCode(sandbox, (await connect(sandbox)).code);
  const post = (body: unknown, headers: Record<string, string> = {}) => revokeRoute(json("https://sml.test/api/connect/revoke", "POST", body, headers));
  expect((await post({ appId: 5 })).status).toBe(400);
  expect((await post({ appId: sandbox.id }, { origin: "https://evil.example" })).status).toBe(403);
  expect((await post({ appId: sandbox.id })).status).toBe(200);
  expect(await getConnection(sandbox, "u1")).toBeNull();
});

test("safeNext honours only same-origin /connect/authorize paths", () => {
  expect(safeNext("/connect/authorize?req=abc.def")).toBe("/connect/authorize?req=abc.def");
  expect(safeNext("/connect/authorize")).toBe("/connect/authorize");
  for (const bad of ["/dashboard", "//evil.com/connect/authorize", "https://evil.com/connect/authorize", "/connect/authorizeX", "/connect/authorize/../x",
    "/connect/authorize\\@evil.com", "\\\\evil.com", "javascript:alert(1)", "", null, undefined, 5, "/connect/authorize\n//evil"]) {
    expect(safeNext(bad)).toBeNull();
  }
});

test("magic-link verify honours a safe next and ignores an unsafe one", async () => {
  const { issueCode } = await import("../src/lib/codes");
  const { POST } = await import("../src/app/api/auth/magic/verify/route");
  const go = async (next: string) => {
    const code = await issueCode(ada, "login", 15);
    const f = new FormData(); f.set("code", code); f.set("next", next);
    const r = await POST(new Request("https://sml.test/api/auth/magic/verify", { method: "POST", body: f }));
    return new URL(r.headers.get("location")!);
  };
  const ok = await go("/connect/authorize?req=abc");
  expect(ok.origin + ok.pathname + ok.search).toBe("https://sml.test/connect/authorize?req=abc");
  const evil = await go("https://evil.example/connect/authorize");
  expect(evil.origin + evil.pathname).toBe("https://sml.test/dashboard");
});

test("session cookies and Connect requests are not interchangeable", async () => {
  const { signSession, verifySession } = await import("../src/lib/session");
  await expect(approve(ada, await signSession(ada), { earnings: false })).rejects.toThrow();
  const url = await createSession(sandbox, { userRef: "u1", redirectUri: CB, state: "s" });
  expect(await verifySession(reqOf(url))).toBeNull();
});

test("revoking or disconnecting kills unused codes issued earlier", async () => {
  const first = await connect(sandbox);
  await revokeByCreator(ada, sandbox.id);
  await expect(exchangeCode(sandbox, first.code)).rejects.toThrow("Code is invalid or expired.");
  expect(await getConnection(sandbox, "u1")).toBeNull();
  const second = await connect(sandbox);
  await disconnect(sandbox, "u1");
  await expect(exchangeCode(sandbox, second.code)).rejects.toThrow("Code is invalid or expired.");
  expect(await getConnection(sandbox, "u1")).toBeNull();
});

test("a failed connection upsert does not burn the code", async () => {
  const { code } = await connect(sandbox);
  await t.sql`create function boom() returns trigger language plpgsql as $$ begin raise exception 'boom'; end $$`;
  await t.sql`create trigger boom before insert on connections for each row execute function boom()`;
  await expect(exchangeCode(sandbox, code)).rejects.toThrow();
  await t.sql`drop trigger boom on connections`;
  expect(await exchangeCode(sandbox, code)).toEqual({ connected: true });
});

test("the authorize page is served with anti-framing headers", async () => {
  const cfg = (await import("../next.config")).default;
  const rules = await cfg.headers!();
  const h = rules.find((r) => r.source === "/connect/authorize")!.headers;
  expect(h).toContainEqual({ key: "Content-Security-Policy", value: "frame-ancestors 'none'" });
  expect(h).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
});
