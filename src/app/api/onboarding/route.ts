import { NextResponse } from "next/server";

import { createCreator } from "@/lib/creators";
import { requireUser, Unauthorized } from "@/lib/session";

const FRIENDLY = /^(That username|You already|3–24|That name|Pick a treat from|Give your)/;

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => ({}));
    const customTreat = b.customTreat && typeof b.customTreat === "object" ? { name: String(b.customTreat.name ?? ""), emoji: String(b.customTreat.emoji ?? "") } : undefined;
    const c = await createCreator(user.id, { username: String(b.username ?? ""), treatId: String(b.treatId ?? ""), customTreat });
    return NextResponse.json({ ok: true, username: c.username });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Error && FRIENDLY.test(e.message)) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
