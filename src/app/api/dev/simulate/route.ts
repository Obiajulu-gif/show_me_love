import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { handleRasEvent } from "@/lib/payments";
import { practiceEnabled } from "@/lib/ras";

/** Practice mode only: pretends RAS reported this payment as paid. */
export async function POST(req: Request) {
  if (!practiceEnabled()) return new NextResponse(null, { status: 404 });
  const b = await req.json().catch(() => null);
  if (!b || typeof b.ref !== "string") return NextResponse.json({ error: "Send a ref." }, { status: 400 });
  const [p] = await db()`select amount_usdt from payments where ref = ${b.ref}`;
  if (!p) return NextResponse.json({ error: "Unknown payment." }, { status: 404 });
  await handleRasEvent({
    event_id: `sim_${b.ref}_${Date.now()}`, event_type: "payment_link_completed",
    meta_data: { payment_reference: b.ref, amount_received: String(p.amount_usdt) },
  });
  return NextResponse.json({ ok: true });
}
