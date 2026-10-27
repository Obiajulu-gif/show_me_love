import { NextResponse } from "next/server";

import { createGoal, GoalError, type GoalInput } from "@/lib/goals";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

const KEYS = ["title", "story", "coverUrl", "currency", "target", "suggested", "showProgress", "showTarget", "organizerName", "organizerPhoto", "headerMode"];


export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Send the goal details." }, { status: 400 });
    const input = Object.fromEntries(Object.entries(b).filter(([k]) => KEYS.includes(k))) as GoalInput;
    return NextResponse.json({ ok: true, goal: await createGoal(user.id, input) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof GoalError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
