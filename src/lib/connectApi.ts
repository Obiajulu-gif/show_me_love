import { NextResponse } from "next/server";

import { authenticateApp, type App } from "./connect";
import { hit } from "./ratelimit";

const INVALID = () => NextResponse.json({ error: "Invalid client credentials." }, { status: 401 });

/**
 * Server-to-server guard: Bearer key + X-Client-Id, 120/min per app. These routes are called by other servers
 * with no cookies, so there is no CSRF surface; bodies must still be JSON.
 */
export async function withApp(req: Request, run: (app: App, body: Record<string, unknown>) => Promise<NextResponse>): Promise<NextResponse> {
  const m = /^Bearer (\S+)$/.exec(req.headers.get("authorization") ?? "");
  const app = m ? await authenticateApp(req.headers.get("x-client-id") ?? "", m[1]) : null;
  if (!app) return INVALID();
  if (!(await hit("connect:" + app.id, 120, 60))) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    if (!(req.headers.get("content-type") ?? "").includes("application/json")) return NextResponse.json({ error: "Send JSON." }, { status: 415 });
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
    body = b;
  }
  return run(app, body);
}

/** user_ref from the query string; null when missing or too long. */
export function userRefParam(req: Request): string | null {
  const v = new URL(req.url).searchParams.get("user_ref");
  return v && v.length <= 128 ? v : null;
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
