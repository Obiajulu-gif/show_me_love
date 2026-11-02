import { Banknote, Flag, Rocket, UserPlus, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import type { ActivityItem } from "@/lib/adminInsights";

export const usd = (v: string | number) => `${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`;

/** "3h ago" up to a week, then a date. Server-rendered on each request, so it is fresh when read. */
export function ago(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function PageHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">{title}</h1>
        {sub && <p className="mt-1 text-muted">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

const ICON = { signup: UserPlus, page: Rocket, payment: Banknote, withdrawal: Wallet, report: Flag } as const;
const TONE = { good: "bg-accent/15 text-accent", bad: "bg-danger/15 text-danger", warn: "bg-warn/15 text-warn", plain: "bg-surface-2 text-muted" } as const;

export function ActivityList({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <p className="py-6 text-center text-muted">Nothing has happened yet.</p>;
  return (
    <ol className="divide-y divide-line">
      {items.map((e, i) => {
        const Icon = ICON[e.kind];
        return (
          <li key={i}>
            <Link href={e.href} className="flex items-center gap-3 px-1 py-3 hover:bg-surface-2/40">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[e.tone]}`}><Icon size={16} aria-hidden /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{e.title}</span>
                <span className="data block truncate text-xs text-muted">{e.detail}</span>
              </span>
              <time dateTime={e.at.toISOString()} title={e.at.toLocaleString("en-GB")} className="shrink-0 text-xs text-muted">{ago(e.at)}</time>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export const STATUS_TONE: Record<string, string> = {
  successful: "text-accent", paid: "text-accent", pending: "text-warn", awaiting_review: "text-warn", processing: "text-warn",
  failed: "text-danger", expired: "text-muted", refunded: "text-love", rejected: "text-danger",
};
