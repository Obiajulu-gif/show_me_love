import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";

import { CreatorPage } from "@/components/CreatorPage";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import { listCatalog } from "@/lib/catalog";
import { getCreatorByUsername } from "@/lib/creators";
import { toPageView, treatMap } from "@/lib/pageView";
import { publicWall } from "@/lib/stats";
import { resolveUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-cream-2 text-cocoa">
      <header className="flex items-center justify-between bg-cocoa px-5 py-3">
        <span className="[&_a]:text-cream"><Logo /></span>
        <Link href="/signup" className={buttonClass("primary", "text-sm")}>Create your page</Link>
      </header>
      <main className="mx-auto max-w-xl px-4 py-8">
        <CreatorPage creator={view} mode="live" payments={await publicWall(c.userId)} />
      </main>
      <footer className="pb-8 text-center text-sm text-cocoa-2">
        <p>Small treats, real support.</p>
        <p className="mt-1 space-x-4">
          <Link href="/legal/terms" className="underline">Terms</Link>
          <Link href="/legal/privacy" className="underline">Privacy</Link>
          <a href={`mailto:support@show-me-love.app?subject=Report%20@${c.username}`} className="underline">Report page</a>
        </p>
      </footer>
    </div>
  );
}
