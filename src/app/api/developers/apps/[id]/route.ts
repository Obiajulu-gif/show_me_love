import { NextResponse } from "next/server";

import { ConnectError, NOT_FOUND, updateApp } from "@/lib/connect";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Send the fields to change." }, { status: 400 });
    return NextResponse.json({ ok: true, app: await updateApp(user.id, id, { name: b.name, redirectUris: b.redirectUris }) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ConnectError) return NextResponse.json({ error: e.message }, { status: e.message === NOT_FOUND ? 404 : 400 });
    throw e;
  }
}
