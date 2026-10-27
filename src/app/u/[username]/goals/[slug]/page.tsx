import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { GoalBar } from "@/components/GoalBar";
import { GoalContribute } from "@/components/GoalContribute";
import { Logo } from "@/components/Logo";
import { ThanksStatus } from "@/components/ThanksStatus";
import { buttonClass } from "@/components/ui/Button";
import { getCreatorByUsername } from "@/lib/creators";
import { formatMoney } from "@/lib/goalFormat";
import { getPublicGoal, goalContributors, goalPaymentStatus, goalProgress } from "@/lib/goals";
import { rasMode } from "@/lib/ras";
import { resolveUsername } from "@/lib/usernames";

export const dynamic = "force-dynamic";

export default async function GoalPage({ params, searchParams }: { params: Promise<{ username: string; slug: string }>; searchParams: Promise<{ ref?: string; thanks?: string }> }) {
  const { username, slug } = await params;
  const sp = await searchParams;
  const r = await resolveUsername(username);
  if (!r) notFound();
  if (r.redirected) permanentRedirect(`/@${r.username}/goals/${slug}`);
  const goal = await getPublicGoal(r.username, slug);
  if (!goal) notFound();
  const c = (await getCreatorByUsername(r.username))!;

  const { raised, count } = await goalProgress(goal.id);
  const people = goal.showProgress ? await goalContributors(goal.id) : [];
  const thanks = sp.thanks === "1" && sp.ref ? await goalPaymentStatus(goal.id, sp.ref) : null;
  const showThanks = thanks && (thanks.status === "pending" || thanks.status === "successful");
  const organizer = goal.organizerName || goal.organizerFallback;
  const organizerPhoto = goal.organizerPhoto || c.photoUrl;

  return (
    <div className="min-h-screen bg-cream-2 text-cocoa">
      {goal.headerMode === "default" && (
        <header className="flex items-center justify-between bg-cocoa px-5 py-3">
          <span className="[&_a]:text-cream"><Logo /></span>
          <Link href="/signup" className={buttonClass("primary", "text-sm")}>Create your page</Link>
        </header>
      )}
      {goal.headerMode === "logo" && (
        <header className="flex items-center gap-3 bg-cocoa px-5 py-3 text-cream">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.photoUrl && <img src={c.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />}
          <Link href={`/@${c.username}`} className="font-semibold">{c.displayName ?? c.username}</Link>
        </header>
      )}
      <main className="mx-auto max-w-xl space-y-5 px-4 py-8">
        {showThanks && (
          <ThanksStatus ref_={sp.ref!} username={c.username} initial={thanks.status} amountNgn={thanks.amountNgn} canSimulate={rasMode() === "practice"} />
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {goal.coverUrl && <img src={goal.coverUrl} alt="" className="h-56 w-full rounded-[18px] object-cover" />}
        <div>
          <h1 className="font-serif text-3xl italic">{goal.title}</h1>
          <p className="mt-2 inline-flex items-center gap-2 text-sm text-cocoa-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {organizerPhoto && <img src={organizerPhoto} alt="" className="h-6 w-6 rounded-full object-cover" />}
            A goal by {organizer}
          </p>
        </div>
        {goal.paused && <p role="status" className="rounded-xl bg-cocoa px-4 py-2 text-sm font-semibold text-cream">Paused: this goal is not taking contributions right now.</p>}
        {goal.story && <p className="whitespace-pre-line text-sm leading-relaxed">{goal.story}</p>}
        {goal.showProgress && (
          <div className="space-y-2">
            <GoalBar raised={raised} target={goal.target} />
            <p className="text-sm">
              <strong>{formatMoney(goal.currency, raised)}</strong> raised
              {goal.showTarget && <> of {formatMoney(goal.currency, goal.target)}</>} · {count} {count === 1 ? "contribution" : "contributions"}
            </p>
          </div>
        )}
        {!goal.showProgress && goal.showTarget && <p className="text-sm">Aiming for <strong>{formatMoney(goal.currency, goal.target)}</strong></p>}
        <GoalContribute goalId={goal.id} currency={goal.currency} suggested={goal.suggested} paused={goal.paused} />
        {goal.showProgress && (
          <section aria-label="Contributors" className="space-y-2">
            <h2 className="font-semibold">Contributors</h2>
            {people.length === 0 ? <p className="text-sm text-cocoa-2">Be the first to chip in.</p> : (
              <ul className="space-y-2">
                {people.map((p, i) => (
                  <li key={i} className="rounded-xl border border-line bg-cream p-3 text-sm">
                    <span className="font-semibold">{p.name}</span>
                    {p.message && <p className="mt-1 text-cocoa-2">{p.message}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
