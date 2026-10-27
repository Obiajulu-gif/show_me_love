import { NextResponse } from "next/server";

import { requireUser, Unauthorized } from "@/lib/session";
import { setDestination, WithdrawalError, type Destination } from "@/lib/withdrawals";

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || (b.kind !== "usdt" && b.kind !== "bank")) return NextResponse.json({ error: "Pick USDT or bank." }, { status: 400 });
    await setDestination(user.id, b as Destination);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof WithdrawalError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
