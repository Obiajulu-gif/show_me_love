import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";

import { CreatorPage, type PageView } from "@/components/CreatorPage";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import { listCatalog, type CatalogItem } from "@/lib/catalog";
import { getCreatorByUsername } from "@/lib/creators";
import { publicWall } from "@/lib/stats";
import { resolveUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

export default async function PublicPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const r = await resolveUsername(username);
  if (!r) notFound();
  if (r.redirected) permanentRedirect(`/@${r.username}`);
  const c = (await getCreatorByUsername(r.username))!;

  let treat: CatalogItem | undefined;
  const walk = (items: CatalogItem[]) => items.forEach((t) => { if (t.id === c.treatId) treat = t; walk(t.children); });
  walk(await listCatalog());
  const view: PageView = {
    username: c.username, displayName: c.displayName ?? c.username, bio: c.bio ?? "", photoUrl: c.photoUrl,
    treatName: c.customTreat?.name ?? treat?.name ?? "Treat", treatImage: c.customTreat ? "" : treat?.image ?? "",
    unitPriceNgn: c.unitPriceNgn, presets: c.presets, thankYouText: c.thankYouText ?? "",
    tagline: c.pageStyle.tagline ?? "", accent: c.pageStyle.accent ?? "honey", header: c.pageStyle.header ?? "default",
    coverUrl: (c.pageStyle.cover as string | undefined) ?? null, socials: Object.values(c.socials),
  };

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
