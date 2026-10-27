import type { PageView } from "@/components/CreatorPage";
import type { CatalogItem } from "./catalog";

export type TreatMap = Record<string, { name: string; image: string }>;

export function treatMap(items: CatalogItem[], out: TreatMap = {}): TreatMap {
  for (const t of items) { out[t.id] = { name: t.name, image: t.image ?? "" }; treatMap(t.children, out); }
  return out;
}

export type PageViewInput = {
  username: string; displayName: string; bio: string; photoUrl: string | null;
  treatId: string | null; customTreat?: { name: string } | null;
  unitPriceNgn: number; presets: number[]; thankYouText: string;
  tagline?: string; accent?: string; header?: string; coverUrl?: string | null; socials: string[];
};

/** One mapping from a saved creator or unsaved editor state to what CreatorPage draws. */
export function toPageView(i: PageViewInput, treats: TreatMap): PageView {
  const custom = i.treatId === "custom" || !!i.customTreat;
  const t = i.treatId ? treats[i.treatId] : undefined;
  return {
    username: i.username, displayName: i.displayName, bio: i.bio, photoUrl: i.photoUrl,
    treatName: custom ? i.customTreat?.name || "Treat" : t?.name ?? "Treat", treatImage: custom ? "" : t?.image ?? "",
    unitPriceNgn: Number.isFinite(i.unitPriceNgn) && i.unitPriceNgn > 0 ? i.unitPriceNgn : 0,
    presets: i.presets.length ? i.presets.slice(0, 3) : [1], thankYouText: i.thankYouText,
    tagline: i.tagline ?? "", accent: i.accent ?? "honey", header: i.header ?? "default", coverUrl: i.coverUrl ?? null, socials: i.socials,
  };
}
