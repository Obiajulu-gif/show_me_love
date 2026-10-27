import { NextResponse } from "next/server";

import { expireStale } from "@/lib/payments";
import { pollProcessing } from "@/lib/withdrawals";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, expired: await expireStale(), settled: await pollProcessing() });
}
