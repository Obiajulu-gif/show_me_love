import { redirect } from "next/navigation";

import { GoalsManager, type GoalRow } from "@/components/GoalsManager";
import { getCreatorByUser } from "@/lib/creators";
import { goalProgress, listGoals } from "@/lib/goals";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Goals() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const creator = (await getCreatorByUser(uid))!;
  const rows: GoalRow[] = await Promise.all((await listGoals(uid)).map(async (g) => {
    const p = await goalProgress(g.id);
    return {
      id: g.id, slug: g.slug, title: g.title, story: g.story, coverUrl: g.coverUrl, currency: g.currency, target: g.target, suggested: g.suggested,
      showProgress: g.showProgress, showTarget: g.showTarget, organizerName: g.organizerName, organizerPhoto: g.organizerPhoto,
      headerMode: g.headerMode, currencyLocked: g.currencyLocked, paused: g.paused, raised: p.raised, count: p.count,
    };
  }));
  return <GoalsManager goals={rows} username={creator.username} origin={(process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "")} />;
}
