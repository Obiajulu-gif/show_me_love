import { PageEditor } from "@/components/PageEditor";
import { listCatalog } from "@/lib/catalog";
import { treatMap } from "@/lib/pageView";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";

export default async function YourPage() {
  const creator = (await getCreatorByUser((await currentUserId())!))!;
  const treats = treatMap(await listCatalog());
  return <PageEditor creator={creator} treats={treats} />;
}
