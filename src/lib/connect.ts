import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { db } from "./db";

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
    let url: URL;
    try { url = new URL(u); } catch { throw new ConnectError(`"${u.slice(0, 60)}" is not a valid link.`); }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!(url.protocol === "https:" || (url.protocol === "http:" && local))) throw new ConnectError("Redirect links must start with https:// (http:// is only allowed for localhost).");
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
  // The count check and the insert are one statement, so two quick requests can't slip past the limit.
  const [row] = await db()`
    insert into apps (owner_id, name, mode, redirect_uris, client_id)
    select ${userId}, ${name}, ${input.mode}, ${uris}::text[], ${clientId}
    where (select count(*) from apps where owner_id = ${userId}) < ${MAX_APPS}
    returning *`;
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
  const [row] = await sql`
    insert into api_keys (app_id, prefix, last4, key_hash)
    select ${appId}, ${key.slice(0, 12)}, ${key.slice(-4)}, ${sha256(key)}
    where (select count(*) from api_keys where app_id = ${appId} and revoked_at is null) < ${MAX_KEYS}
    returning id`;
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
