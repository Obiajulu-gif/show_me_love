import { headers } from "next/headers";
import { NextResponse } from "next/server";

/** Client IP, hardest to spoof first: Vercel's header, x-real-ip, then the LAST x-forwarded-for hop (the one our proxy appended). */
export function pickIp(h: Pick<Headers, "get">): string {
  const last = h.get("x-forwarded-for")?.split(",").pop()?.trim();
  return h.get("x-vercel-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip")?.trim() || last || "local";
}

export async function clientIp(): Promise<string> {
  return pickIp(await headers());
}

/** Origin-only CSRF check (use for multipart): a present Origin must match PUBLIC_APP_URL's origin (or the request's own when unset). */
export function rejectCrossOrigin(req: Request): NextResponse | null {
  const origin = req.headers.get("origin");
  if (origin) {
    let expected: string;
    try { expected = new URL(process.env.PUBLIC_APP_URL || req.url).origin; } catch { expected = new URL(req.url).origin; }
    if (origin !== expected) return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  }
  return null;
}

/** CSRF guard for cookie-authenticated JSON POST routes: the Origin check plus a JSON content-type, which a cross-site form cannot send. Returns a response to send back, or null to continue. */
export function rejectCrossSite(req: Request): NextResponse | null {
  const blocked = rejectCrossOrigin(req);
  if (blocked) return blocked;
  if (!(req.headers.get("content-type") ?? "").includes("application/json")) {
    return NextResponse.json({ error: "Send JSON." }, { status: 415 });
  }
  return null;
}
