import { NextResponse } from "next/server";

import { ConnectError, createApp, type AppInput } from "@/lib/connect";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Send the app details." }, { status: 400 });
    return NextResponse.json({ ok: true, app: await createApp(user.id, { name: b.name, mode: b.mode, redirectUris: b.redirectUris } as AppInput) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ConnectError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
