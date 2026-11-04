import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { Logo } from "@/components/Logo";
import { StampStudio } from "@/components/StampStudio";
import { listCatalog } from "@/lib/catalog";
import { getCreatorByUsername } from "@/lib/creators";
import { appOrigin } from "@/lib/http";
import { toPageView, treatMap } from "@/lib/pageView";
import { creatorLink } from "@/lib/share";
import { getActiveCampaignByCreator } from "@/lib/stamps";
import { resolveUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const r = await resolveUsername(username);
  if (!r) return { title: "Page not found" };
  const c = await getCreatorByUsername(r.username);
  if (!c) return { title: "Page not found" };
  const name = c.displayName ?? c.username;
  return {
    title: `Make a support stamp for ${name}`,
    description: `Put your photo on a stamp for @${c.username} and share it with their link.`,
    alternates: { canonical: `/@${c.username}/stamp` },
    robots: { index: false, follow: true },
  };
}

export default async function StampPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const r = await resolveUsername(username);
  if (!r) notFound();
  if (r.redirected) permanentRedirect(`/@${r.username}/stamp`);
  const c = await getCreatorByUsername(r.username);
  if (!c) notFound();
  const campaign = await getActiveCampaignByCreator(c.userId);
  if (!campaign) notFound();

  const view = toPageView({
    username: c.username, displayName: c.displayName ?? c.username, bio: c.bio ?? "", photoUrl: c.photoUrl,
    treatId: c.treatId, customTreat: c.customTreat, unitPriceNgn: c.unitPriceNgn, presets: c.presets,
    thankYouText: c.thankYouText ?? "", accent: c.pageStyle.accent, socials: [],
  }, treatMap(await listCatalog()));
  const link = creatorLink(c.username, await appOrigin());

  return (
    <div className="theme-paper min-h-screen bg-canvas text-fg">
      <header className="border-b border-line bg-canvas/80 px-5 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4">
          <Logo />
          <Link href={`/@${c.username}`} className="text-sm font-semibold text-muted transition-colors hover:text-fg">Back to @{c.username}</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] px-4 py-7 sm:py-10">
        <StampStudio
          campaignId={campaign.id}
          style={campaign.style}
          headline={campaign.headline}
          creatorName={view.displayName}
          username={c.username}
          treatName={view.treatName}
          link={link}
        />
      </main>
      <footer className="pb-10 text-center text-sm text-muted">
        <p>Small stamps, real support.</p>
      </footer>
    </div>
  );
}
