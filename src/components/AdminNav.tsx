"use client";
import { Activity, Flag, Gauge, Receipt, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Logo } from "./Logo";

const NAV = [
  { href: "/admin", label: "Overview", Icon: Gauge, badge: null },
  { href: "/admin/activity", label: "Activity", Icon: Activity, badge: null },
  { href: "/admin/users", label: "Users", Icon: Users, badge: null },
  { href: "/admin/payments", label: "Payments", Icon: Receipt, badge: null },
  { href: "/admin/withdrawals", label: "Withdrawals", Icon: Wallet, badge: "withdrawals" },
  { href: "/admin/reports", label: "Reports", Icon: Flag, badge: "reports" },
] as const;

/** Admin navigation: a sidebar from md up, a scrolling tab row on phones. Badges count work waiting. */
export function AdminNav({ counts }: { counts: { withdrawals: number; reports: number } }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === href : path.startsWith(href));
  const link = (n: (typeof NAV)[number], row: boolean) => {
    const count = n.badge ? counts[n.badge] : 0;
    return (
      <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}
        className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150 ${active(n.href) ? "bg-surface-2 text-fg" : "text-muted hover:text-fg"} ${row ? "" : "w-full"}`}>
        <n.Icon size={17} aria-hidden className={active(n.href) ? "text-accent" : ""} />
        {n.label}
        {count > 0 && <span className="data ml-auto rounded-full bg-warn/15 px-1.5 text-xs text-warn" aria-label={`${count} waiting`}>{count}</span>}
      </Link>
    );
  };
  return (
    <>
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-surface-2/40 p-4 md:flex" aria-label="Admin">
        <Logo href="/admin" />
        <p className="mt-1 pl-[42px] text-xs text-muted">Admin console</p>
        <nav className="mt-6 flex flex-col gap-1">{NAV.map((n) => link(n, false))}</nav>
        <Link href="/dashboard" className="mt-auto rounded-xl px-3 py-2 text-sm text-muted hover:text-fg">Back to my dashboard</Link>
      </aside>
      <div className="sticky top-0 z-20 border-b border-line bg-canvas/90 backdrop-blur md:hidden">
        <div className="flex items-center justify-between px-4 pt-3"><Logo href="/admin" /><Link href="/dashboard" className="text-xs text-muted underline">Dashboard</Link></div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 py-2">{NAV.map((n) => link(n, true))}</nav>
      </div>
    </>
  );
}
