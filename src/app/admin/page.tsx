import Link from "next/link";

import { ActivityList, ago, PageHead, usd } from "@/components/AdminUi";
import { Card } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/admin";
import { activity, listUsers, platformStats } from "@/lib/adminInsights";

export default async function AdminHome() {
  await requireAdminPage();
  const [s, feed, newest] = await Promise.all([platformStats(), activity({ limit: 12 }), listUsers({ limit: 6 })]);

  const tiles = [
    { label: "Users", value: String(s.users.total), note: `${s.users.new7d} joined this week`, href: "/admin/users" },
    { label: "Live pages", value: String(s.creators.total), note: `${s.creators.new7d} new this week`, href: "/admin/users" },
    { label: "Treats received", value: usd(s.payments.receivedUsdt), note: `${usd(s.payments.received7dUsdt)} this week, ${s.payments.successful} payments`, href: "/admin/payments?status=successful", money: true },
    { label: "Platform fees earned", value: usd(s.feesUsdt), note: "Taken from treats and payouts", href: "/admin/payments?status=successful", money: true },
    { label: "Owed to creators", value: usd(s.owedUsdt), note: `${usd(s.withdrawals.paidUsdt)} paid out so far`, href: "/admin/withdrawals", money: true },
  ];
  const attention = [
    { n: s.withdrawals.awaitingReview, text: ["withdrawal", "withdrawals"], tail: "waiting for review", href: "/admin/withdrawals" },
    { n: s.withdrawals.processing, text: ["withdrawal", "withdrawals"], tail: "stuck in sending", href: "/admin/withdrawals" },
    { n: s.openReports, text: ["open report", "open reports"], tail: "", href: "/admin/reports" },
    { n: s.payments.failed7d, text: ["payment", "payments"], tail: "failed or expired this week", href: "/admin/payments?status=failed" },
    { n: s.payments.pending, text: ["checkout", "checkouts"], tail: "still open", href: "/admin/payments?status=pending" },
  ].filter((a) => a.n > 0);

  return (
    <div className="space-y-8">
      <PageHead title="Overview" sub="Everything happening on show-me-love, newest first." />

      <section aria-label="Needs attention" className={`rounded-2xl border px-5 py-4 ${attention.length ? "border-warn/40 bg-warn/5" : "border-line bg-surface/50"}`}>
        {attention.length ? (
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {attention.map((a) => <li key={a.text[1] + a.tail}><Link href={a.href} className="hover:underline"><span className="data font-semibold text-warn">{a.n}</span> {a.text[a.n === 1 ? 0 : 1]} {a.tail}</Link></li>)}
          </ul>
        ) : <p className="text-sm text-muted">Nothing needs you right now. No withdrawals to review, no open reports.</p>}
      </section>

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className="group rounded-2xl border border-line bg-surface/70 p-5 transition-colors duration-150 hover:border-accent/50">
            <p className="text-sm text-muted">{t.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${t.money ? "data font-medium" : "font-display"}`}>{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.note}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0 !p-5">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Latest activity</h2><Link href="/admin/activity" className="text-sm text-muted underline hover:text-fg">See all</Link></div>
          <ActivityList items={feed} />
        </Card>
        <Card className="min-w-0 !p-5">
          <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold">Newest users</h2><Link href="/admin/users" className="text-sm text-muted underline hover:text-fg">All {s.users.total}</Link></div>
          <ul className="divide-y divide-line">
            {newest.rows.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{u.username ? `@${u.username}` : u.email}</span>
                  <span className="block truncate text-xs text-muted">{u.username ? u.email : "No page yet"}{u.role === "admin" ? ", admin" : ""}</span>
                </span>
                <span className="shrink-0 text-xs text-muted">{ago(u.joined)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
