import { NextResponse } from "next/server";

import { approve, ConnectError, deny } from "@/lib/connect";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

/** Browser route (cookie auth): the authorize page posts the creator's decision here. */
export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || Array.isArray(b) || typeof b.req !== "string" || (b.decision !== "allow" && b.decision !== "deny")
      || (b.earnings !== undefined && typeof b.earnings !== "boolean")) {
      return NextResponse.json({ error: "Send req, decision and an optional earnings flag." }, { status: 400 });
    }
    const redirect = b.decision === "allow" ? await approve(user.id, b.req, { earnings: b.earnings === true }) : await deny(b.req);
    return NextResponse.json({ redirect });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof ConnectError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
