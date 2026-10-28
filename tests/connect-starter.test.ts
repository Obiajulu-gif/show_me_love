import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";

import { POST as connectRoute } from "../examples/connect-starter/app/api/sml/connect/route";
import { GET as callbackRoute } from "../examples/connect-starter/app/api/sml/callback/route";
import { POST as disconnectRoute } from "../examples/connect-starter/app/api/sml/disconnect/route";
import { stateOk } from "../examples/connect-starter/lib/demo";
import { sml } from "../examples/connect-starter/lib/sml";
import { GET as connectionRoute } from "../src/app/api/connect/connection/route";
import { POST as disconnectApi } from "../src/app/api/connect/disconnect/route";
import { POST as sessionsRoute } from "../src/app/api/connect/sessions/route";
import { POST as tokenRoute } from "../src/app/api/connect/token/route";
import { approve, createApp, createKey, deny, revokeByCreator, type App } from "../src/lib/connect";
import { createCreator } from "../src/lib/creators";
import { startTestDb } from "../src/lib/testing";

// Drives the starter's real route handlers; its fetch calls are routed straight into this app's Connect routes.
const ORIGIN = "http://sml.test";
const CB = "http://localhost:3001/api/sml/callback";
const ROUTES: Record<string, (r: Request) => Promise<Response>> = {
  "POST /api/connect/sessions": sessionsRoute, "POST /api/connect/token": tokenRoute,
  "GET /api/connect/connection": connectionRoute, "POST /api/connect/disconnect": disconnectApi,
};

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
let bola: string;
let app: App;
beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", ORIGIN);
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bola }] = await t.sql`insert into users (email) values ('bola@x.com') returning id`;
  await createCreator(ada, { username: "ada", treatId: "coffee" });
});
afterAll(async () => { await t.stop(); vi.unstubAllGlobals(); });
beforeEach(async () => {
  await t.sql`delete from apps`;
  await t.sql`delete from rate_limits`;
  app = await createApp(bola, { name: "Starter", mode: "sandbox", redirectUris: [CB] });
  const { key } = await createKey(bola, app.id);
  vi.stubEnv("SML_ORIGIN", ORIGIN);
  vi.stubEnv("SML_CLIENT_ID", app.clientId);
  vi.stubEnv("SML_API_KEY", key);
  vi.stubEnv("APP_ORIGIN", "http://localhost:3001");
  vi.stubEnv("SML_REDIRECT_URI", CB);
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const route = ROUTES[`${init?.method ?? "GET"} ${u.pathname}`];
    return route ? route(new Request(url, init)) : new Response("{}", { status: 404 });
  });
});

const LOGGED_IN = { cookie: "demo_user=1" };
const cookieOf = (res: Response) => /sml_state=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")![1];

async function startConnect() {
  const res = await connectRoute(new Request("http://localhost:3001/api/sml/connect", { method: "POST", headers: LOGGED_IN }));
  expect(res.status).toBe(303);
  const state = cookieOf(res);
  const req = new URL(res.headers.get("location")!).searchParams.get("req")!;
  return { state, req };
}
const callback = (qs: string, state?: string) =>
  callbackRoute(new Request(`http://localhost:3001/api/sml/callback?${qs}`, { headers: { cookie: `demo_user=1${state ? `; sml_state=${state}` : ""}` } }));
const connection = () => sml("/connection?user_ref=demo-user-42");

test("connect, allow, callback, support link, disconnect", async () => {
  expect((await connection()).status).toBe(404);
  const { state, req } = await startConnect();
  const back = new URL(await approve(ada, req, { earnings: false }));
  expect(back.searchParams.get("state")).toBe(state);
  const res = await callback(back.searchParams.toString(), state);
  expect(res.headers.get("location")).toBe("http://localhost:3001/");
  const c = await connection();
  expect(c.status).toBe(200);
  expect(c.data.support_url).toBe(`${ORIGIN}/@ada`);

  await disconnectRoute(new Request("http://localhost:3001/api/sml/disconnect", { method: "POST", headers: LOGGED_IN }));
  expect((await connection()).status).toBe(404);
});

test("the callback rejects a wrong or missing state and never exchanges the code", async () => {
  const { state, req } = await startConnect();
  const back = new URL(await approve(ada, req, { earnings: false }));
  const code = back.searchParams.get("code")!;
  for (const cookie of [undefined, "other"]) {
    const res = await callback(`code=${code}&state=${state}`, cookie);
    expect(res.headers.get("location")).toContain("error=Bad+state");
  }
  expect((await connection()).status).toBe(404);
  expect((await callback(`code=${code}&state=${state}`, state)).headers.get("location")).toBe("http://localhost:3001/");
  expect((await connection()).status).toBe(200);
});

test("deny and revoke leave the starter not connected", async () => {
  const a = await startConnect();
  const denied = new URL(await deny(a.req));
  expect((await callback(denied.searchParams.toString(), a.state)).headers.get("location")).toContain("denied=1");
  expect((await connection()).status).toBe(404);

  const b = await startConnect();
  const ok = new URL(await approve(ada, b.req, { earnings: false }));
  await callback(ok.searchParams.toString(), b.state);
  expect((await connection()).status).toBe(200);
  await revokeByCreator(ada, app.id);
  expect((await connection()).status).toBe(404);
});

test("connect needs the demo login; stateOk is strict", async () => {
  const res = await connectRoute(new Request("http://localhost:3001/api/sml/connect", { method: "POST" }));
  expect(res.headers.get("location")).toBe("http://localhost:3001/");
  expect(res.headers.get("set-cookie")).toBeNull();
  expect(stateOk(undefined, null)).toBe(false);
  expect(stateOk("", "")).toBe(false);
  expect(stateOk("a", "b")).toBe(false);
  expect(stateOk("a", "a")).toBe(true);
});
