import { NextResponse } from "next/server";

import { approveWithdrawal, Forbidden, markNgnPaid, rejectWithdrawal, requireAdmin, resolveStuckPaid, resolveStuckRelease } from "@/lib/admin";
import { Unauthorized } from "@/lib/session";
import { WithdrawalError } from "@/lib/withdrawals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const b = await req.json().catch(() => null);
    const note = String(b?.note ?? "");
    switch (b?.action) {
      case "approve": await approveWithdrawal(admin.id, id); break;
      case "paid": await markNgnPaid(admin.id, id, String(b.bankReference ?? "")); break;
      case "reject": await rejectWithdrawal(admin.id, id, note); break;
      case "stuck_paid": await resolveStuckPaid(admin.id, id, note); break;
      case "stuck_release": await resolveStuckRelease(admin.id, id, note); break;
      default: return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Forbidden) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof WithdrawalError) return NextResponse.json({ error: e.message }, { status: 400 });
    // A malformed uuid in the path is a user error, not a 500.
    if ((e as { code?: string })?.code === "22P02") return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }
}
