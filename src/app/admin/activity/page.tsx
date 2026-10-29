import Link from "next/link";

import { ActivityList, PageHead } from "@/components/AdminUi";
import { Card } from "@/components/ui/Card";
import { requireAdminPage } from "@/lib/admin";
import { activity, ACTIVITY_KINDS, type ActivityKind } from "@/lib/adminInsights";

const LABEL: Record<ActivityKind, string> = { signup: "Sign-ups", page: "New pages", payment: "Payments", withdrawal: "Withdrawals", report: "Reports" };

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  await requireAdminPage();
  const k = (await searchParams).kind;
  const kind = (ACTIVITY_KINDS as readonly string[]).includes(k ?? "") ? (k as ActivityKind) : undefined;
  const items = await activity({ limit: 200, kind });
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={label} href={href} aria-current={on ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-sm transition-colors duration-150 ${on ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-fg"}`}>{label}</Link>
  );
  return (
    <div className="space-y-6">
      <PageHead title="Activity" sub="The last 200 events. Open checkouts are left out until they pay or fail." />
      <nav aria-label="Filter activity" className="flex flex-wrap gap-2">
        {chip("/admin/activity", "Everything", !kind)}
        {ACTIVITY_KINDS.map((x) => chip(`/admin/activity?kind=${x}`, LABEL[x], kind === x))}
      </nav>
      <Card className="min-w-0 !p-5"><ActivityList items={items} /></Card>
    </div>
  );
}
