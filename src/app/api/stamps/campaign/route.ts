import { NextResponse } from "next/server";

import { getCreatorByUser } from "@/lib/creators";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";
import { saveCampaign, StampInputError, type CampaignInput } from "@/lib/stamps";

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const creator = await getCreatorByUser(user.id);
    if (!creator) return NextResponse.json({ error: "Finish your page first." }, { status: 400 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Send the stamp settings." }, { status: 400 });
    const campaign = await saveCampaign(creator.userId, body as CampaignInput, creator.pageStyle.accent ?? "honey");
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof StampInputError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
