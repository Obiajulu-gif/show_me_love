import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { db } from "./db";
import { totalReceived } from "./ledger";
import { secret } from "./session";

/** Safe to show to the developer. */
export class ConnectError extends Error {}

export type AppMode = "sandbox" | "live";
export type App = { id: string; ownerId: string; name: string; mode: AppMode; redirectUris: string[]; clientId: string; createdAt: Date };
export type AppInput = { name: string; mode: AppMode; redirectUris: string[] };
export type KeyRow = { id: string; prefix: string; last4: string; createdAt: Date; revokedAt: Date | null };

export const NOT_FOUND = "We couldn't find that app.";
export const KEY_NOT_FOUND = "We couldn't find that key.";
const MAX_APPS = 10;
const MAX_KEYS = 5;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const keyPrefix = (mode: AppMode) => (mode === "live" ? "sml_live_" : "sml_test_");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toApp(r: any): App {
  return { id: r.id, ownerId: r.owner_id, name: r.name, mode: r.mode, redirectUris: r.redirect_uris, clientId: r.client_id, createdAt: r.created_at };
}

function checkName(v: unknown): string {
  const name = typeof v === "string" ? v.trim() : "";
  if (name.length < 3 || name.length > 60) throw new ConnectError("App name must be 3 to 60 characters.");
  return name;
}

function checkUris(v: unknown): string[] {
  if (!Array.isArray(v) || v.length < 1 || v.length > 5) throw new ConnectError("Add 1 to 5 redirect links.");
  for (const u of v) {
    if (typeof u !== "string" || u.length > 300) throw new ConnectError("Each redirect link can be at most 300 characters.");
    if (/[\s\x00-\x1f\x7f]/.test(u)) throw new ConnectError("Redirect links can't contain spaces or hidden characters.");
    let url: URL;
    try { url = new URL(u); } catch { throw new ConnectError(`"${u.slice(0, 60)}" is not a valid link.`); }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!(url.protocol === "https:" || (url.protocol === "http:" && local))) throw new ConnectError("Redirect links must start with https:// (http:// is only allowed for localhost).");
    if (url.username || url.password) throw new ConnectError("Redirect links can't contain a username or password.");
    if (url.hash || u.includes("#")) throw new ConnectError("Redirect links can't contain a # fragment.");
  }
  return [...v];
}

export async function listApps(userId: string): Promise<(App & { keys: KeyRow[] })[]> {
  const sql = db();
  const apps = await sql`select * from apps where owner_id = ${userId} order by created_at desc, id`;
  const keys = await sql`select k.* from api_keys k join apps a on a.id = k.app_id where a.owner_id = ${userId} order by k.created_at`;
  return apps.map((a) => ({
    ...toApp(a),
    keys: keys.filter((k) => k.app_id === a.id).map((k) => ({ id: k.id, prefix: k.prefix, last4: k.last4, createdAt: k.created_at, revokedAt: k.revoked_at })),
  }));
}

export async function createApp(userId: string, input: AppInput): Promise<App> {
  const name = checkName(input?.name);
  if (input.mode !== "sandbox" && input.mode !== "live") throw new ConnectError("Pick Sandbox or Live.");
  const uris = checkUris(input.redirectUris);
  const clientId = "sml_app_" + randomBytes(8).toString("hex");
  // A per-user advisory lock serialises concurrent creates, so the count and the insert can't race past the limit.
  const row = await db().begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${userId}))`;
    const [{ n }] = await tx`select count(*)::int as n from apps where owner_id = ${userId}`;
    if (n >= MAX_APPS) return null;
    const [r] = await tx`insert into apps (owner_id, name, mode, redirect_uris, client_id) values (${userId}, ${name}, ${input.mode}, ${uris}::text[], ${clientId}) returning *`;
    return r;
  });
  if (!row) throw new ConnectError(`You can have up to ${MAX_APPS} apps.`);
  return toApp(row);
}

export async function updateApp(userId: string, appId: string, patch: { name?: string; redirectUris?: string[] }): Promise<App> {
  if (!UUID.test(appId)) throw new ConnectError(NOT_FOUND);
  const name = patch.name === undefined ? null : checkName(patch.name);
  const uris = patch.redirectUris === undefined ? null : checkUris(patch.redirectUris);
  const [row] = await db()`
    update apps set name = coalesce(${name}, name), redirect_uris = coalesce(${uris}::text[], redirect_uris)
    where id = ${appId} and owner_id = ${userId} returning *`;
  if (!row) throw new ConnectError(NOT_FOUND);
  return toApp(row);
}

/** The full key is returned here and nowhere else; only its sha256 is stored. */
export async function createKey(userId: string, appId: string): Promise<{ id: string; key: string; prefix: string; last4: string }> {
  if (!UUID.test(appId)) throw new ConnectError(NOT_FOUND);
  const sql = db();
  const [app] = await sql`select mode from apps where id = ${appId} and owner_id = ${userId}`;
  if (!app) throw new ConnectError(NOT_FOUND);
  const key = keyPrefix(app.mode) + randomBytes(32).toString("base64url");
  // Locked on the app id so concurrent requests can't both pass the count.
  const row = await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${appId}))`;
    const [{ n }] = await tx`select count(*)::int as n from api_keys where app_id = ${appId} and revoked_at is null`;
    if (n >= MAX_KEYS) return null;
    const [r] = await tx`insert into api_keys (app_id, prefix, last4, key_hash) values (${appId}, ${key.slice(0, 12)}, ${key.slice(-4)}, ${sha256(key)}) returning id`;
    return r;
  });
  if (!row) throw new ConnectError(`An app can have up to ${MAX_KEYS} active keys. Revoke one first.`);
  return { id: row.id, key, prefix: key.slice(0, 12), last4: key.slice(-4) };
}

export async function revokeKey(userId: string, keyId: string, appId?: string): Promise<void> {
  if (!UUID.test(keyId) || (appId !== undefined && !UUID.test(appId))) throw new ConnectError(KEY_NOT_FOUND);
  const rows = await db()`
    update api_keys k set revoked_at = now() from apps a
    where k.id = ${keyId} and k.app_id = a.id and a.owner_id = ${userId} and k.revoked_at is null
      and (${appId ?? null}::uuid is null or a.id = ${appId ?? null}::uuid)
    returning k.id`;
  if (!rows.length) throw new ConnectError(KEY_NOT_FOUND);
}

/** Returns the app for a valid, unrevoked key of the matching mode; null for anything else. Never throws on bad input. */
export async function authenticateApp(clientId: string, apiKey: string): Promise<App | null> {
  if (typeof clientId !== "string" || typeof apiKey !== "string" || !clientId || apiKey.length < 12 || apiKey.length > 200) return null;
  const sql = db();
  const [a] = await sql`select * from apps where client_id = ${clientId}`;
  if (!a) return null;
  const app = toApp(a);
  if (!apiKey.startsWith(keyPrefix(app.mode))) return null;
  const want = Buffer.from(sha256(apiKey), "hex");
  const keys = await sql`select key_hash from api_keys where app_id = ${app.id} and revoked_at is null`;
  let ok = false;
  for (const k of keys) {
    const have = Buffer.from(String(k.key_hash), "hex");
    if (have.length === want.length && timingSafeEqual(have, want)) ok = true;
  }
  return ok ? app : null;
}

/** Exact string match, no normalisation. */
export function redirectAllowed(app: Pick<App, "redirectUris">, uri: string): boolean {
  return typeof uri === "string" && app.redirectUris.includes(uri);
}

// ---------- Connect authorization flow ----------

export class Forbidden extends ConnectError {}

const AUD = "sml-connect";
const CODE_TTL_MIN = 10;
export const BAD_CODE = "Code is invalid or expired.";
export const BAD_REQUEST = "This authorization link is invalid or has expired.";
export type ConnectReq = { appId: string; userRef: string; redirectUri: string; state: string };
export type Connection = { username: string; display_name: string; support_url: string; earnings_shared: boolean };

const baseUrl = () => (process.env.PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

/** Returns the authorize_url; the request travels as a signed 10-minute JWT. */
export async function createSession(app: App, input: { userRef: string; redirectUri: string; state?: string }): Promise<string> {
  const { userRef, redirectUri } = input;
  const state = input.state ?? "";
  if (typeof userRef !== "string" || userRef.length < 1 || userRef.length > 128) throw new ConnectError("user_ref must be 1 to 128 characters.");
  if (typeof state !== "string" || state.length > 256) throw new ConnectError("state can be at most 256 characters.");
  if (!redirectAllowed(app, redirectUri)) throw new ConnectError("That redirect_uri isn't registered for this app.");
  const jwt = await new SignJWT({ appId: app.id, userRef, redirectUri, state })
    .setProtectedHeader({ alg: "HS256" }).setAudience(AUD).setIssuedAt().setExpirationTime("10m").sign(secret());
  return `${baseUrl()}/connect/authorize?req=${encodeURIComponent(jwt)}`;
}

/** Verifies the JWT (alg and audience pinned) and loads the CURRENT app record. Throws ConnectError on anything wrong. */
export async function loadRequest(req: unknown): Promise<{ app: App; req: ConnectReq }> {
  if (typeof req !== "string" || req.length > 4000) throw new ConnectError(BAD_REQUEST);
  let p;
  try { p = (await jwtVerify(req, secret(), { algorithms: ["HS256"], audience: AUD })).payload; } catch { throw new ConnectError(BAD_REQUEST); }
  const { appId, userRef, redirectUri, state } = p as Record<string, unknown>;
  if (typeof appId !== "string" || !UUID.test(appId) || typeof userRef !== "string" || typeof redirectUri !== "string" || typeof state !== "string") throw new ConnectError(BAD_REQUEST);
  const [a] = await db()`select * from apps where id = ${appId}`;
  if (!a) throw new ConnectError(BAD_REQUEST);
  const app = toApp(a);
  if (!redirectAllowed(app, redirectUri)) throw new ConnectError(BAD_REQUEST);
  return { app, req: { appId, userRef, redirectUri, state } };
}

function back(r: ConnectReq, params: Record<string, string>): string {
  const u = new URL(r.redirectUri);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  if (r.state) u.searchParams.set("state", r.state);
  return u.toString();
}

export async function approve(userId: string, reqJwt: string, opts: { earnings: boolean }): Promise<string> {
  const { app, req } = await loadRequest(reqJwt);
  const [c] = await db()`select 1 from creators where user_id = ${userId}`;
  if (!c) throw new ConnectError("Set up your page before connecting an app.");
  const code = randomBytes(32).toString("base64url");
  await db()`
    insert into auth_codes (code_hash, app_id, user_id, user_ref, earnings_shared, state, expires_at)
    values (${sha256(code)}, ${app.id}, ${userId}, ${req.userRef}, ${opts.earnings === true}, ${req.state}, now() + make_interval(mins => ${CODE_TTL_MIN}))`;
  return back(req, { code });
}

export async function deny(reqJwt: string): Promise<string> {
  const { req } = await loadRequest(reqJwt);
  return back(req, { error: "access_denied" });
}

export async function exchangeCode(app: App, code: string): Promise<{ connected: true }> {
  if (typeof code !== "string" || code.length < 1 || code.length > 200) throw new ConnectError(BAD_CODE);
  const sql = db();
  // One conditional update makes the code single-use even under concurrent exchanges.
  const [row] = await sql`
    update auth_codes set used_at = now()
    where code_hash = ${sha256(code)} and app_id = ${app.id} and used_at is null and expires_at > now()
    returning user_id, user_ref, earnings_shared`;
  if (!row) throw new ConnectError(BAD_CODE);
  await sql`
    insert into connections (app_id, user_ref, user_id, earnings_shared)
    values (${app.id}, ${row.user_ref}, ${row.user_id}, ${row.earnings_shared})
    on conflict (app_id, user_ref) do update
      set user_id = excluded.user_id, earnings_shared = excluded.earnings_shared, revoked_at = null`;
  return { connected: true };
}

export async function getConnection(app: App, userRef: string): Promise<Connection | null> {
  if (typeof userRef !== "string" || !userRef || userRef.length > 128) return null;
  const [r] = await db()`
    select c.username, c.display_name, k.earnings_shared from connections k join creators c on c.user_id = k.user_id
    where k.app_id = ${app.id} and k.user_ref = ${userRef} and k.revoked_at is null`;
  return r ? { username: r.username, display_name: r.display_name ?? r.username, support_url: `${baseUrl()}/@${r.username}`, earnings_shared: r.earnings_shared } : null;
}

/** null when there is no active connection; throws Forbidden when the creator didn't share earnings. */
export async function getEarnings(app: App, userRef: string): Promise<{ total_received: string; currency: "USDT"; treats: number } | null> {
  if (typeof userRef !== "string" || !userRef || userRef.length > 128) return null;
  const [k] = await db()`select user_id, earnings_shared from connections where app_id = ${app.id} and user_ref = ${userRef} and revoked_at is null`;
  if (!k) return null;
  if (!k.earnings_shared) throw new Forbidden("Earnings not shared.");
  if (app.mode === "sandbox") return { total_received: "12.50", currency: "USDT", treats: 5 };
  const [{ n }] = await db()`select count(*)::int as n from payments where creator_id = ${k.user_id} and status = 'successful' and kind <> 'goal'`;
  return { total_received: await totalReceived(k.user_id), currency: "USDT", treats: n };
}

export async function disconnect(app: App, userRef: string): Promise<void> {
  if (typeof userRef !== "string" || !userRef || userRef.length > 128) return;
  await db()`update connections set revoked_at = now() where app_id = ${app.id} and user_ref = ${userRef} and revoked_at is null`;
}

export async function revokeByCreator(userId: string, appId: string): Promise<void> {
  if (!UUID.test(appId)) return;
  await db()`update connections set revoked_at = now() where user_id = ${userId} and app_id = ${appId} and revoked_at is null`;
}

export type ConnectedApp = { appId: string; name: string; mode: AppMode; connectedAt: Date; earningsShared: boolean };

export async function listConnectedApps(userId: string): Promise<ConnectedApp[]> {
  const rows = await db()`
    select a.id, a.name, a.mode, k.created_at, k.earnings_shared from connections k join apps a on a.id = k.app_id
    where k.user_id = ${userId} and k.revoked_at is null order by k.created_at desc, a.id`;
  return rows.map((r) => ({ appId: r.id, name: r.name, mode: r.mode, connectedAt: r.created_at, earningsShared: r.earnings_shared }));
}
