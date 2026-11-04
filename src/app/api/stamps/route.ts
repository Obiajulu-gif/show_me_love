import { NextResponse } from "next/server";

import { clientIp, rejectCrossSite } from "@/lib/http";
import { hit } from "@/lib/ratelimit";
import { getActiveCampaignById, recordStamp, sanitizeStampHandle, sanitizeStampName, StampInputError } from "@/lib/stamps";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Send the stamp details.");
    const { campaignId, name, handle } = body as { campaignId?: unknown; name?: unknown; handle?: unknown };
    if (typeof campaignId !== "string" || !UUID.test(campaignId)) return bad("That stamp campaign is not available.", 404);

    const cleanName = sanitizeStampName(name);
    const cleanHandle = sanitizeStampHandle(handle);

    const campaign = await getActiveCampaignById(campaignId);
    if (!campaign) return bad("That stamp campaign is not available.", 404);

    if (!(await hit(`stamp:ip:${await clientIp()}:${campaignId}`, 10, 3600))) {
      return bad("You've made a lot of stamps. Try again in a little while.", 429);
    }
    if (!(await hit(`stamp:campaign:${campaignId}`, 300, 86400))) {
      return bad("This stamp campaign is taking a breather. Try again tomorrow.", 429);
    }

    const count = await recordStamp({ campaignId: campaign.id, creatorId: campaign.creatorId, name: cleanName, handle: cleanHandle });
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    if (e instanceof StampInputError) return bad(e.message);
    throw e;
  }
}
