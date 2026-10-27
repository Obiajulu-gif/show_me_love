import { PageEditor } from "@/components/PageEditor";
import { listCatalog, type CatalogItem } from "@/lib/catalog";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";

export default async function YourPage() {
  const creator = (await getCreatorByUser((await currentUserId())!))!;
  const treats: Record<string, { name: string; image: string }> = {};
  const walk = (items: CatalogItem[]) => items.forEach((t) => { treats[t.id] = { name: t.name, image: t.image ?? "" }; walk(t.children); });
  walk(await listCatalog());
  return <PageEditor creator={creator} treats={treats} />;
}
