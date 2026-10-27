import { NextResponse } from "next/server";

import { checkGroup } from "@/lib/groups";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    await requireUser();
    const b = await req.json().catch(() => null);
    const names = b && typeof b === "object" ? (b as { usernames?: unknown }).usernames : null;
    if (!Array.isArray(names) || names.length > 25 || names.some((x) => typeof x !== "string" || x.length > 40)) {
      return NextResponse.json({ error: "Send the usernames to check." }, { status: 400 });
    }
    return NextResponse.json(await checkGroup(names as string[]));
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
