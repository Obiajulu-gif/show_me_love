import { redirect } from "next/navigation";

import { StampManager } from "@/components/StampManager";
import { listCatalog } from "@/lib/catalog";
import { getCreatorByUser } from "@/lib/creators";
import { appOrigin } from "@/lib/http";
import { toPageView, treatMap } from "@/lib/pageView";
import { creatorLink } from "@/lib/share";
import { currentUserId } from "@/lib/session";
import { getCampaignByCreator, isStampStyle, stampStats } from "@/lib/stamps";

export const dynamic = "force-dynamic";

export default async function StampsPage() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const creator = (await getCreatorByUser(uid))!;
  const [campaign, stats, catalog, origin] = await Promise.all([
    getCampaignByCreator(uid),
    stampStats(uid),
    listCatalog(),
    appOrigin(),
  ]);
  const view = toPageView({
    username: creator.username, displayName: creator.displayName ?? creator.username, bio: creator.bio ?? "", photoUrl: creator.photoUrl,
    treatId: creator.treatId, customTreat: creator.customTreat, unitPriceNgn: creator.unitPriceNgn, presets: creator.presets,
    thankYouText: creator.thankYouText ?? "", accent: creator.pageStyle.accent, socials: [],
  }, treatMap(catalog));
  const defaultStyle = isStampStyle(creator.pageStyle.accent) ? creator.pageStyle.accent : "honey";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Stamps</p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">Turn supporters into billboards.</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">They put their photo on your stamp, download it, and share it. Every stamp carries your link and QR.</p>
      </div>
      <StampManager
        campaign={campaign}
        link={creatorLink(creator.username, origin)}
        stats={stats}
        defaultStyle={defaultStyle}
        displayName={view.displayName}
        username={creator.username}
        treatName={view.treatName}
      />
    </div>
  );
}
