"use client";
import { ArrowUpRight, Code2, Gift, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Share2, Target, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "./Logo";

const WORKSPACE = [
  { href: "/dashboard", label: "Overview", Icon: Home },
  { href: "/dashboard/your-page", label: "Your page", Icon: Pencil },
  { href: "/dashboard/treats", label: "Treats", Icon: Gift },
  { href: "/dashboard/group", label: "Support a group", Icon: Users },
  { href: "/dashboard/goals", label: "Goals", Icon: Target },
  { href: "/dashboard/share", label: "Share", Icon: Share2 },
];
const MONEY = [
  { href: "/dashboard/withdrawals", label: "Withdrawals", Icon: Wallet },
  { href: "/dashboard/developers", label: "Developers", Icon: Code2 },
];

export function Sidebar({ username, displayName, photoUrl }: { username: string; displayName: string; photoUrl: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const active = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));
  const item = (href: string, label: string, Icon: typeof Home, compact: boolean) => (
    <Link key={href} href={href} onClick={() => setOpen(false)} title={label} aria-current={active(href) ? "page" : undefined}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors duration-150 ${compact ? "justify-center px-0" : ""} ${
        active(href)
          ? "bg-accent/10 text-accent shadow-[inset_2px_0_0_rgb(var(--accent))]"
          : "text-muted hover:bg-surface hover:text-fg"
      }`}>
      <Icon size={17} className="shrink-0" aria-hidden />
      {!compact && label}
    </Link>
  );

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const body = (compact: boolean) => (
    <>
      {!compact && (
        <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent/15 font-display text-xs font-extrabold text-accent">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : (displayName[0] ?? "?").toUpperCase()}
          </span>
          <div className="min-w-0">
            <b className="block truncate text-[12.5px] leading-tight text-fg">{displayName}</b>
            <small className="block truncate text-[11px] text-muted">@{username}</small>
          </div>
        </div>
      )}

      <div className={`mt-5 ${compact ? "" : "px-1"}`}>
        {!compact && <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Workspace</p>}
        <nav className="flex flex-col gap-0.5" aria-label="Workspace">{WORKSPACE.map((n) => item(n.href, n.label, n.Icon, compact))}</nav>
      </div>

      <div className={`mt-4 ${compact ? "" : "px-1"}`}>
        {!compact && <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted">Money</p>}
        <nav className="flex flex-col gap-0.5" aria-label="Money">{MONEY.map((n) => item(n.href, n.label, n.Icon, compact))}</nav>
      </div>

      <div className={`mt-auto flex flex-col gap-1 pt-6 ${compact ? "" : "px-1"}`}>
        <Link href={`/@${username}`} target="_blank" title="View your page"
          className={`mb-2 flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] font-semibold text-fg transition-colors hover:border-accent/50 ${compact ? "justify-center px-0" : ""}`}>
          <ArrowUpRight size={16} className="shrink-0 text-accent" aria-hidden />{!compact && "View your page"}
        </Link>
        <button type="button" onClick={signOut} title="Sign out"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-[13.5px] font-semibold text-muted transition-colors hover:bg-surface hover:text-fg ${compact ? "justify-center px-0" : ""}`}>
          <LogOut size={17} className="shrink-0" aria-hidden />{!compact && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo href="/dashboard" />
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-fg/25 backdrop-blur-sm motion-safe:animate-scrim-in" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col border-r border-line bg-surface p-4 motion-safe:animate-[drawer-in_.26s_cubic-bezier(.16,1,.3,1)_reverse]" aria-label="Menu">
            <div className="flex items-center justify-between"><Logo href="/dashboard" /><button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg"><X size={20} /></button></div>
            {body(false)}
          </aside>
        </div>
      )}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-surface-2/40 p-4 transition-[width] duration-200 ease-out md:flex ${collapsed ? "w-[76px]" : "w-60"}`} aria-label="Sidebar">
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && <Logo href="/dashboard" />}
          <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-fg">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        {body(collapsed)}
      </aside>
    </>
  );
}
