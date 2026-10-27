"use client";
import { Code2, Coins, Gift, Home, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Share2, Target, Users, Wallet, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "./Logo";
import { buttonClass } from "./ui/Button";

const NAV = [
  { href: "/dashboard", label: "Overview", Icon: Home },
  { href: "/dashboard/your-page", label: "Your page", Icon: Pencil },
  { href: "/dashboard/treats", label: "Treats", Icon: Gift },
  { href: "/dashboard/group", label: "Support a group", Icon: Users },
  { href: "/dashboard/goals", label: "Goals", Icon: Target },
  { href: "/dashboard/withdrawals", label: "Withdrawals", Icon: Wallet },
  { href: "/dashboard/share", label: "Share", Icon: Share2 },
];

export function Sidebar({ username }: { username: string }) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);

  const active = (href: string) => (href === "/dashboard" ? path === href : path.startsWith(href));
  const item = (href: string, label: string, Icon: typeof Home, compact: boolean) => (
    <Link key={href} href={href} onClick={() => setOpen(false)} title={label} aria-current={active(href) ? "page" : undefined}
      className={`flex items-center gap-3 rounded-full px-3 py-2 text-sm font-semibold transition ${active(href) ? "bg-honey text-honey-ink" : "text-cocoa hover:bg-cream-2"}`}>
      <Icon size={18} className="shrink-0" />
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
      <nav className="mt-6 flex flex-col gap-1">{NAV.map((n) => item(n.href, n.label, n.Icon, compact))}</nav>
      <div className="mt-auto flex flex-col gap-1 pt-6">
        <Link href={`/@${username}`} target="_blank" className={buttonClass("primary", "mb-2 px-3")} title="View your page">
          <Coins size={18} className="shrink-0" />{!compact && "View your page"}
        </Link>
        {item("/dashboard/developers", "Developers", Code2, compact)}
        <button type="button" onClick={signOut} title="Sign out" className="flex items-center gap-3 rounded-full px-3 py-2 text-left text-sm font-semibold text-cocoa hover:bg-cream-2">
          <LogOut size={18} className="shrink-0" />{!compact && "Sign out"}
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="flex items-center justify-between border-b border-line bg-cream px-4 py-3 md:hidden">
        <Logo href="/dashboard" />
        <button type="button" aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-cream-2"><Menu /></button>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-cocoa/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-cream p-4" aria-label="Menu">
            <div className="flex items-center justify-between"><Logo href="/dashboard" /><button type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button></div>
            {body(false)}
          </aside>
        </div>
      )}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-cream p-4 transition-all md:flex ${collapsed ? "w-[72px]" : "w-60"}`} aria-label="Sidebar">
        <div className="flex items-center justify-between">
          {!collapsed && <Logo href="/dashboard" />}
          <button type="button" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-2 hover:bg-cream-2">
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        {body(collapsed)}
      </aside>
    </>
  );
}
