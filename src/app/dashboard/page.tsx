import { ArrowUpRight, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CopyButton } from "@/components/ShareTools";
import { buttonClass } from "@/components/ui/Button";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";
import { creatorLink } from "@/lib/share";
import { overview } from "@/lib/stats";

function when(at: Date) {
  const ms = Date.now() - new Date(at).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default async function Overview({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const welcome = (await searchParams).welcome === "1";
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const c = await getCreatorByUser(uid);
  if (!c) redirect("/onboarding");
  const o = await overview(uid);
  const name = c.displayName || c.username;
  const firstName = name.split(/\s+/)[0];
  const money = (usdt: string) => ({
    value: `${Number(usdt).toFixed(2)} USDT`,
    note: o.ngnPerUsd ? `about ₦${Math.round(Number(usdt) * o.ngnPerUsd).toLocaleString("en-NG")}` : undefined,
  });
  const steps = [
    { done: o.setup.page, label: "Create your page", href: "/dashboard/your-page", action: "Edit" },
    { done: o.setup.photoBio, label: "Add a photo and a short bio", href: "/dashboard/your-page", action: "Add" },
    { done: o.treatCount > 0, label: "Get your first treat", href: "/dashboard/share", action: "Share" },
  ];
  const done = steps.filter((s) => s.done).length;
  const latestNote = o.recent.find((r) => r.message?.trim());
  const link = creatorLink(c.username);
  const balance = money(o.balanceUsdt);
  const total = money(o.totalReceivedUsdt);

  return (
    <div className="mx-auto max-w-[1180px] space-y-6">
      {welcome && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-accent/40 bg-accent/10 px-5 py-4 motion-safe:animate-dialog-in">
          <p className="text-sm"><span className="font-bold text-fg">Your page is live.</span> <span className="text-muted">Share <span className="data text-fg">show-me-love/@{c.username}</span> to start receiving treats.</span></p>
          <Link href="/dashboard/share" className={buttonClass("primary", "rounded-full px-4 py-1.5 text-sm")}>Share it</Link>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Overview</p>
          <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">Hi {firstName}</h1>
          <p className="mt-2 text-sm text-muted">Your page is live · {o.treatCount} {o.treatCount === 1 ? "treat" : "treats"} received so far.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/your-page" className={buttonClass("ghost", "rounded-full px-4 py-2 text-sm")}>Edit page</Link>
          <Link href="/dashboard/share" className={buttonClass("primary", "rounded-full px-4 py-2 text-sm")}>Share my page</Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,.75fr)]">
        <div className="min-w-0 space-y-4">
          <section aria-labelledby="balance-title" className="rounded-[20px] border border-line bg-surface p-5 shadow-lift sm:p-6">
            <p id="balance-title" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Available balance</p>
            <p className="mt-2 flex flex-wrap items-baseline gap-2">
              <span className="font-display text-[clamp(2.4rem,5vw,3.6rem)] font-extrabold leading-none tracking-[-0.04em] text-green tabular-nums">{Number(o.balanceUsdt).toFixed(2)}</span>
              <span className="text-sm font-bold text-muted">USDT</span>
            </p>
            {balance.note && <p className="data mt-2 text-sm text-muted">{balance.note}{o.ngnPerUsd ? ` · 1 USDT = ₦${o.ngnPerUsd.toLocaleString("en-NG")}` : ""}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link href="/dashboard/withdrawals" className={buttonClass("primary", "rounded-full px-4 py-2 text-sm")}>Withdraw</Link>
              <span className="text-xs text-muted">To your bank or a USDT wallet</span>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <small className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Received so far</small>
                <b className="data mt-1 block text-lg font-semibold text-fg">{total.value}</b>
                {total.note && <span className="data mt-0.5 block text-[11px] text-muted">{total.note}</span>}
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-3.5">
                <small className="block text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">Treats received</small>
                <b className="data mt-1 block text-lg font-semibold text-fg">{o.treatCount}</b>
                <span className="mt-0.5 block text-[11px] text-muted">{o.treatCount === 0 ? "Share your page to start" : "Every treat carries a note"}</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="activity-title" className="min-w-0 rounded-[20px] border border-line bg-surface p-5 shadow-lift sm:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="activity-title" className="font-display text-lg font-extrabold tracking-tight">Latest support</h2>
              <Link href="/dashboard/treats" className="text-xs font-semibold text-muted underline decoration-line underline-offset-4 hover:text-fg">See all</Link>
            </div>
            {o.recent.length ? (
              <ul className="mt-3 divide-y divide-line">
                {o.recent.map((r) => (
                  <li key={r.ref} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-display text-[11px] font-extrabold text-accent">{(r.from[0] ?? "?").toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-fg">{r.from}{r.viaGroup && <span className="ml-2 rounded-full border border-line px-1.5 py-0.5 text-[9px] font-normal text-muted">group</span>}</p>
                      {r.message?.trim()
                        ? <p className="truncate font-serif text-[15px] italic leading-snug text-muted">“{r.message}”</p>
                        : <p className="text-[11px] text-muted">sent {r.quantity} {r.quantity === 1 ? "treat" : "treats"}</p>}
                    </div>
                    <div className="shrink-0 text-right">
                      <b className="data block text-[12.5px] font-semibold text-green">+{Number(r.amountUsdt).toFixed(2)}</b>
                      <small className="block text-[10px] text-muted">{r.quantity} {r.quantity === 1 ? "treat" : "treats"} · {when(r.createdAt)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5 text-sm text-muted">No treats yet. Share your page and your first one will show up here.</p>
            )}
          </section>

        </div>

        <div className="min-w-0 space-y-4">
          <section aria-labelledby="setup-title" className="rounded-[20px] border border-line bg-surface p-5 shadow-lift">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="setup-title" className="font-display text-lg font-extrabold tracking-tight">Page setup</h2>
              <span className="text-[11px] font-semibold text-muted">{done} of {steps.length}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
            </div>
            <ul className="mt-3 space-y-2">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-2 text-[12.5px]">
                  {s.done ? <CheckCircle2 size={15} className="shrink-0 text-accent" aria-label="Done" /> : <Circle size={15} className="shrink-0 text-muted" aria-label="Not done yet" />}
                  <span className={s.done ? "text-muted line-through decoration-line" : "text-fg"}>{s.label}</span>
                  {!s.done && <Link href={s.href} className="ml-auto shrink-0 text-[11px] font-bold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent">{s.action} →</Link>}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="note-title" className="rounded-[20px] border border-line bg-surface p-5 shadow-lift">
            <h2 id="note-title" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Latest note</h2>
            {latestNote ? (
              <>
                <p className="mt-3 font-serif text-[clamp(1.25rem,2vw,1.55rem)] italic leading-[1.25] tracking-[-0.01em] text-fg">“{latestNote.message}”</p>
                <div className="mt-4 flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-display text-[11px] font-extrabold text-accent">{(latestNote.from[0] ?? "?").toUpperCase()}</span>
                  <div className="min-w-0">
                    <b className="block truncate text-[12.5px] text-fg">{latestNote.from}</b>
                    <small className="block text-[10.5px] text-muted">{latestNote.quantity} {latestNote.quantity === 1 ? "treat" : "treats"} · ₦{latestNote.amountNgn.toLocaleString("en-NG")}</small>
                  </div>
                  <span className="ml-auto text-lg text-love" aria-label="Love">♥</span>
                </div>
              </>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5 text-sm text-muted">Your first note will land here. Supporters can leave one when they send a treat.</p>
            )}
          </section>

          <section aria-labelledby="link-title" className="rounded-[20px] border border-line bg-surface p-5 shadow-lift">
            <h2 id="link-title" className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">Your page link</h2>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface-2 p-2.5">
              <span className="data min-w-0 flex-1 truncate text-[12px] text-fg">show-me-love/@{c.username}</span>
              <CopyButton text={link} label="Copy" />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted">
              <Link href={`/@${c.username}`} target="_blank" className="inline-flex items-center gap-1 font-semibold text-fg underline decoration-line underline-offset-4 hover:decoration-accent">Open my page <ArrowUpRight size={12} aria-hidden /></Link>
              <Link href="/dashboard/share" className="underline decoration-line underline-offset-4 hover:text-fg">QR code &amp; embeds</Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
