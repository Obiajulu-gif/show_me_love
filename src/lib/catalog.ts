import { db } from "./db";

export type CatalogItem = {
  id: string; name: string; aliases: string[]; emoji: string | null; image: string | null;
  category: string | null; children: CatalogItem[];
};

export async function listCatalog(): Promise<CatalogItem[]> {
  const rows = await db()`
    select id, name, aliases, emoji, image, category, parent_id from treat_catalog
    where active order by sort_order, id`;
  const items = rows.map((r) => ({ id: r.id, name: r.name, aliases: r.aliases, emoji: r.emoji, image: r.image, category: r.category, children: [] as CatalogItem[] }));
  const byId = new Map(items.map((i) => [i.id, i]));
  return rows.flatMap((r, n) => {
    if (!r.parent_id) return [items[n]];
    byId.get(r.parent_id)?.children.push(items[n]);
    return [];
  });
}
