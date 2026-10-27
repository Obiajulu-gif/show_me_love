import { NextResponse } from "next/server";

import { pickIp, rejectCrossSite } from "@/lib/http";
import { ReportError, submitReport } from "@/lib/reports";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  const b = await req.json().catch(() => null);
  try {
    await submitReport({ username: String(b?.username ?? ""), reason: String(b?.reason ?? ""), details: b?.details, reporterEmail: b?.reporterEmail }, pickIp(req.headers));
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ReportError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
