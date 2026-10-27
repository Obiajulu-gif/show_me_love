import { NextResponse } from "next/server";

import { paymentStatus } from "@/lib/checkout";

export async function GET(_req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const s = /^[A-Z0-9]{20}$/.test(ref) ? await paymentStatus(ref) : null;
  return s ? NextResponse.json({ ok: true, ...s }) : NextResponse.json({ error: "Payment not found." }, { status: 404 });
}
