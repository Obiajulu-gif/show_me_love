import { NextResponse } from "next/server";

import { Forbidden, requireAdmin, resolveReport } from "@/lib/admin";
import { rejectCrossSite } from "@/lib/http";
import { Unauthorized } from "@/lib/session";
import { WithdrawalError } from "@/lib/withdrawals";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const admin = await requireAdmin();
    await resolveReport(admin.id, (await params).id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Forbidden) return NextResponse.json({ error: e.message }, { status: 403 });
    if (e instanceof WithdrawalError) return NextResponse.json({ error: e.message }, { status: 400 });
    if ((e as { code?: string })?.code === "22P02") return NextResponse.json({ error: "Not found." }, { status: 404 });
    throw e;
  }
}
