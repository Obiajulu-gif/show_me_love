import { NextResponse } from "next/server";

import { GoalError, setPaused, updateGoal, type GoalInput } from "@/lib/goals";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

const KEYS = ["title", "story", "coverUrl", "currency", "target", "suggested", "showProgress", "showTarget", "organizerName", "organizerPhoto", "headerMode"];

/** PATCH { paused: boolean } toggles pause; any other fields edit the goal. Always scoped to the signed-in creator. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b)) return NextResponse.json({ error: "Send the fields to change." }, { status: 400 });
    if ("paused" in b) {
      if (typeof b.paused !== "boolean" || Object.keys(b).length > 1) return NextResponse.json({ error: "Send paused on its own, or the fields to change." }, { status: 400 });
      return NextResponse.json({ ok: true, goal: await setPaused(user.id, id, b.paused) });
    }
    const patch = Object.fromEntries(Object.entries(b).filter(([k]) => KEYS.includes(k))) as Partial<GoalInput>;
    return NextResponse.json({ ok: true, goal: await updateGoal(user.id, id, patch) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof GoalError) return NextResponse.json({ error: e.message }, { status: e.message.startsWith("We couldn") ? 404 : 400 });
    throw e;
  }
}
