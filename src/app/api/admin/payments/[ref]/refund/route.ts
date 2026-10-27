import { NextResponse } from "next/server";

import { Forbidden, refundPayment, requireAdmin } from "@/lib/admin";
import { rejectCrossSite } from "@/lib/http";
import { Unauthorized } from "@/lib/session";
import { WithdrawalError } from "@/lib/withdrawals";

export async function POST(req: Request, { params }: { params: Promise<{ ref: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const admin = await requireAdmin();
    const { ref } = await params;
    const b = await req.json().catch(() => null);
    const r = await refundPayment(admin.id, ref, { address: String(b?.address ?? ""), network: String(b?.network ?? "") });
    return NextResponse.json({ ok: true, outcome: r.outcome });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Forbidden) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof WithdrawalError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
