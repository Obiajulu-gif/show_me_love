import { NextResponse } from "next/server";

import { revokeByCreator } from "@/lib/connect";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || typeof b.appId !== "string") return NextResponse.json({ error: "Send the appId." }, { status: 400 });
    await revokeByCreator(user.id, b.appId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
