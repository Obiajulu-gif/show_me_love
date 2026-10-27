import { redirect } from "next/navigation";

import { GroupSupport } from "@/components/GroupSupport";
import { groupHistory, groupPaymentStatus } from "@/lib/groups";
import { rasMode } from "@/lib/ras";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Group({ searchParams }: { searchParams: Promise<{ ref?: string; thanks?: string }> }) {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const { ref, thanks } = await searchParams;
  const status = thanks && ref ? await groupPaymentStatus(uid, ref) : null;
  const history = (await groupHistory(uid)).map((h) => ({ ...h, createdAt: h.createdAt.toISOString() }));
  return <GroupSupport history={history} thanks={status && ref ? { ref, ...status } : null} canSimulate={rasMode() === "practice"} />;
}
