/** Copy shared by /docs and the Developers integration guide, so the two never drift apart. */

export const ENV_BLOCK = `SML_ORIGIN=https://your-show-me-love-host
SML_CLIENT_ID=sml_app_xxxxxxxxxxxxxxxx
SML_API_KEY=sml_test_xxxxxxxx   # server only, never in the browser
APP_ORIGIN=http://localhost:3001
SML_REDIRECT_URI=http://localhost:3001/api/sml/callback`;

export const HELPER_SNIPPET = `// lib/sml.ts (server only)
export async function sml(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(process.env.SML_ORIGIN + "/api/connect" + path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: "Bearer " + process.env.SML_API_KEY,
      "X-Client-Id": process.env.SML_CLIENT_ID!,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}`;

export const CONNECT_SNIPPET = `// app/api/sml/connect/route.ts
import { cookies } from "next/headers";
import { sml } from "@/lib/sml";

export async function POST() {
  const userRef = await myOwnSessionUserId(); // from YOUR session, never from the request
  const state = crypto.randomUUID();
  (await cookies()).set("sml_state", state, { httpOnly: true, sameSite: "lax", maxAge: 600, path: "/" });
  const { status, data } = await sml("/sessions", {
    method: "POST",
    body: { user_ref: userRef, redirect_uri: process.env.SML_REDIRECT_URI, state },
  });
  if (status !== 200) return Response.json(data, { status: 502 });
  return Response.json({ url: data.authorize_url }); // the browser goes there
}`;

export const CALLBACK_SNIPPET = `// app/api/sml/callback/route.ts
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const saved = (await cookies()).get("sml_state")?.value;
  if (!saved || q.get("state") !== saved) return new Response("Bad state", { status: 400 });
  if (q.get("error") === "access_denied") return Response.redirect(process.env.APP_ORIGIN + "/?denied=1");
  await sml("/token", { method: "POST", body: { code: q.get("code") } }); // { connected: true }
  return Response.redirect(process.env.APP_ORIGIN + "/");
}`;

export const SHOW_SNIPPET = `// Anywhere on the server
const { status, data } = await sml("/connection?user_ref=" + encodeURIComponent(userRef));
if (status === 200) {
  // data.support_url, data.display_name, data.username, data.earnings_shared
} else if (status === 404) {
  // not connected: show the Connect button
}`;

export const SMOKE_STEPS = [
  "Create a Sandbox app in Developers and add your callback link as a redirect link.",
  "Create a key, copy it into your server env, and restart.",
  "Press your Connect button, then Allow on the show-me-love screen.",
  "Check that your page now shows the support link.",
  "Revoke the app from the Share page and reload: your page should show not connected.",
];

export const AI_PROMPT = `Add "Connect show-me-love" to my existing web app using plain fetch (no SDK).

Env (server only): SML_ORIGIN, SML_CLIENT_ID, SML_API_KEY, APP_ORIGIN, SML_REDIRECT_URI.
Never expose SML_API_KEY to the browser.

Every call goes to \${SML_ORIGIN}/api/connect/... with headers:
  Authorization: Bearer \${SML_API_KEY}
  X-Client-Id: \${SML_CLIENT_ID}
  Content-Type: application/json (POST only)

Endpoints:
- POST /sessions  body {user_ref, redirect_uri, state?}  -> 200 {authorize_url}. redirect_uri must match a registered link exactly.
- POST /token     body {code}  -> 200 {connected: true}. Codes are single use and last 10 minutes.
- GET  /connection?user_ref=...  -> 200 {username, display_name, support_url, earnings_shared} or 404 {error:"Not connected."}
- GET  /earnings?user_ref=...    -> 200 {total_received, currency:"USDT", treats}; 403 if the creator did not share earnings; 404 if not connected
- POST /disconnect body {user_ref} -> 200 {ok: true}
Errors are {error: string}: 400 bad input, 401 bad credentials, 403 not allowed, 404 not found, 415 body is not JSON, 429 too many requests (120/min).

Build:
1. A server route "connect": take user_ref from MY logged-in session (never from the request), generate a random state, store it in an httpOnly cookie, call POST /sessions, send the browser to authorize_url.
2. A callback route at SML_REDIRECT_URI: compare the state query param with the cookie, handle ?error=access_denied, then POST /token with the code.
3. A place in my UI that calls GET /connection and shows support_url (or a Connect button on 404).
4. A Disconnect action that calls POST /disconnect.
Use my existing auth to get the user id. Keep all show-me-love calls on the server.`;
