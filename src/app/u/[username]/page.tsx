import type { Metadata } from "next";
import { ReportDialog } from "@/components/ReportDialog";
import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";

import { CreatorPage } from "@/components/CreatorPage";
import { SupportHeatmap } from "@/components/SupportHeatmap";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import { listCatalog } from "@/lib/catalog";
import { getCreatorByUsername } from "@/lib/creators";
import { toPageView, treatMap } from "@/lib/pageView";
import { publicTreatDates, publicWall } from "@/lib/stats";
import { resolveUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const r = await resolveUsername(username);
  if (!r) return { title: "Page not found" };
  const c = await getCreatorByUsername(r.username);
  if (!c) return { title: "Page not found" };
  const name = c.displayName ?? c.username;
  const description = c.bio?.trim() || `Support ${name} with a small treat on show-me-love.`;
  const url = `/@${c.username}`;
  const image = c.photoUrl ?? undefined;
  return {
    title: `${name} (@${c.username})`,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "profile",
      title: `${name} on show-me-love`,
      description,
      url,
      images: image ? [{ url: image, alt: name }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: `${name} on show-me-love`,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const r = await resolveUsername(username);
  if (!r) notFound();
  if (r.redirected) permanentRedirect(`/@${r.username}`);
  const c = (await getCreatorByUsername(r.username))!;

  const view = toPageView({
    username: c.username, displayName: c.displayName ?? c.username, bio: c.bio ?? "", photoUrl: c.photoUrl,
    treatId: c.treatId, customTreat: c.customTreat, unitPriceNgn: c.unitPriceNgn, presets: c.presets, thankYouText: c.thankYouText ?? "",
    tagline: c.pageStyle.tagline, accent: c.pageStyle.accent, header: c.pageStyle.header,
    coverUrl: c.pageStyle.cover as string | undefined, socials: Object.values(c.socials),
  }, treatMap(await listCatalog()));

  return (
    <div className="theme-paper min-h-screen bg-canvas text-fg">
      <header className="border-b border-line bg-canvas/80 px-5 py-3.5 backdrop-blur">
        <div className="mx-auto flex max-w-[680px] items-center justify-between gap-4">
          <Logo />
          <Link href="/signup" className={buttonClass("primary", "rounded-full px-4 py-1.5 text-sm")}>Create your page</Link>
        </div>
      </header>
      <main className="mx-auto max-w-[620px] px-4 py-7 sm:py-10">
        <CreatorPage creator={view} mode="live" payments={await publicWall(c.userId)} />
        <SupportHeatmap dates={await publicTreatDates(c.userId, new Date(Date.now() - 84 * 864e5))} />
      </main>
      <footer className="pb-10 text-center text-sm text-muted">
        <p>Small treats, real support.</p>
        <div className="mt-1 space-x-4">
          <Link href="/legal#terms" className="underline hover:text-fg">Terms</Link>
          <Link href="/legal#privacy" className="underline hover:text-fg">Privacy</Link>
          <ReportDialog username={c.username} />
        </div>
      </footer>
    </div>
  );
}
