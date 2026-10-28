import { NextResponse } from "next/server";

import { pickIp, rejectCrossSite } from "@/lib/http";
import { ReportError, submitReport } from "@/lib/reports";

const MAX_BODY = 8 * 1024;

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  // Public endpoint: refuse oversize bodies before parsing (content-length first, then the real size for chunked bodies).
  const tooBig = NextResponse.json({ error: "Report is too large." }, { status: 413 });
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return tooBig;
  const raw = await req.text().catch(() => "");
  if (raw.length > MAX_BODY) return tooBig;
  let b: { username?: unknown; reason?: unknown; details?: unknown; reporterEmail?: unknown } | null = null;
  try { b = JSON.parse(raw); } catch { /* handled below as empty */ }
  try {
    await submitReport({ username: String(b?.username ?? ""), reason: String(b?.reason ?? ""), details: b?.details as string | undefined, reporterEmail: b?.reporterEmail as string | undefined }, pickIp(req.headers));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
