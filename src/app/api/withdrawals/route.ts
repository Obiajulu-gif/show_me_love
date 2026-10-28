import { NextResponse } from "next/server";

import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";
import { quoteWithdrawal, STUCK, requestWithdrawal, WithdrawalError, type Method } from "@/lib/withdrawals";

function oops(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof WithdrawalError) return NextResponse.json({ error: e.message }, { status: 400 });
  throw e;
}

/** Fee preview: ?method=usdt|ngn_bank&amount=4.5 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const u = new URL(req.url).searchParams;
    return NextResponse.json({ ok: true, quote: await quoteWithdrawal(user.id, u.get("method") as Method, u.get("amount") ?? "") });
  } catch (e) { return oops(e); }
}

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return NextResponse.json({ error: "Send the withdrawal details." }, { status: 400 });
    const w = await requestWithdrawal(user.id, { method: b.method, amountUsdt: b.amount, code: String(b.code ?? "") });
    return NextResponse.json({ ok: true, withdrawal: { id: w.id, status: w.status, stuck: (w as unknown as { admin_note?: string }).admin_note === STUCK } });
  } catch (e) { return oops(e); }
}
