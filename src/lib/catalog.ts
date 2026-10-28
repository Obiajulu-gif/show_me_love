import { db } from "./db";

export type CatalogItem = {
  id: string; name: string; aliases: string[]; image: string | null;
  category: string | null; children: CatalogItem[];
};

/** Treats with a real photo in public/treats/; brand options reuse their parent's photo. */
const PHOTOS = new Set(["malt", "zobo", "suya", "jollof", "coffee", "glucose-d", "ribena", "lucozade", "chapman", "trophy"]);

/** Photo for a catalog row whatever its stored image is, so databases seeded before the photos still show them. */
export function treatPhoto(id: string, parentId: string | null, stored: string | null): string | null {
  const key = parentId ?? id;
  return PHOTOS.has(key) ? `/treats/${key}.webp` : stored;
}

export async function listCatalog(): Promise<CatalogItem[]> {
  const rows = await db()`
    select id, name, aliases, image, category, parent_id from treat_catalog
    where active order by sort_order, id`;
  const items = rows.map((r) => ({
    id: r.id, name: r.name, aliases: r.aliases, image: treatPhoto(r.id, r.parent_id, r.image),
    category: r.category, children: [] as CatalogItem[],
  }));
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.flatMap((r, n) => {
    if (!r.parent_id) return [items[n]];
    byId.get(r.parent_id)?.children.push(items[n]);
    return [];
  });
}
