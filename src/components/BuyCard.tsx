"use client";
import { useState } from "react";
import { ArrowLeft, Gift, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";

import type { WalletPay as Pay } from "@/lib/walletPay";

// Wallet libraries load only when a supporter reaches the pay step.
const WalletPay = dynamic(() => import("./WalletPay").then((m) => m.WalletPay), { ssr: false, loading: () => <p className="text-sm text-muted">Loading wallets…</p> });

export type BuyCardProps = { creatorName?: string; treatName: string; treatImage: string; unitPriceNgn: number; presets: number[]; mode: "preview" | "live"; username?: string; onSend?: (qty: number) => void };

const field = "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-fg placeholder:text-muted/70 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20";

/** The supporter-facing "send a treat" box. Preview mode draws the same card, inert; live mode posts to /api/checkout. */
export function BuyCard({ creatorName, treatName, treatImage, unitPriceNgn, presets, mode, username, onSend }: BuyCardProps) {
  const [qty, setQty] = useState(presets[0] ?? 1);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [f, setF] = useState({ name: "", email: "", message: "", isPublic: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [pay, setPay] = useState<{ ref: string; url: string; wallet: Pay } | null>(null);
  const live = mode === "live";
  const total = custom ? Math.floor(Number(amount) || 0) : unitPriceNgn * qty;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const firstName = creatorName?.trim().split(/\s+/)[0];
  const treat = treatName.toLowerCase();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!live) return onSend?.(qty);
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, ...(custom ? { amountNgn: total } : { quantity: qty }), ...f }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url && j.wallet) { setPay(j); setBusy(false); return; }
      if (r.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Couldn't reach the server. Please try again."); }
    setBusy(false);
  }

  if (pay) return (
    <section aria-label="Pay" className="rounded-[18px] border border-line bg-canvas p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold tracking-tight">Pay with your wallet</h2>
        <button type="button" onClick={() => setPay(null)} className="inline-flex items-center gap-1 text-xs text-muted underline hover:text-fg"><ArrowLeft size={12} aria-hidden />Change order</button>
      </div>
      <WalletPay pay={pay.wallet} payRef={pay.ref} roqquUrl={pay.url} thanksUrl={`/@${username}/thanks?ref=${pay.ref}`} />
    </section>
  );

  return (
    <form onSubmit={submit} className="rounded-[18px] border border-line bg-[#FFFDF8] p-4 sm:p-5">
      <fieldset disabled={!live || busy} className="disabled:opacity-100">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {treatImage ? <img src={treatImage} alt="" className="h-14 w-14 shrink-0 rounded-2xl border border-line object-cover" /> : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-accent"><Gift size={24} aria-hidden /></span>}
          <div className="min-w-0">
            <h2 className="font-display text-[19px] font-bold leading-tight tracking-[-0.025em]">Buy {firstName ?? "me"} a {treat}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">₦{unitPriceNgn.toLocaleString("en-NG")} each · every treat carries a note</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10.5px] font-extrabold uppercase tracking-[0.12em] text-muted">How many?</span>
          <div className="flex overflow-hidden rounded-xl border border-line bg-surface" role="group" aria-label="Quantity">
            {presets.map((n) => (
              <button key={n} type="button" aria-pressed={!custom && n === qty} onClick={() => { setCustom(false); setQty(n); }}
                className={`border-r border-line px-3.5 py-1.5 text-[13px] font-bold transition-colors ${!custom && n === qty ? "bg-fg text-canvas" : "text-muted hover:text-fg"}`}>{n}</button>
            ))}
            <button type="button" aria-pressed={custom} onClick={() => setCustom(true)}
              className={`px-3 py-1.5 text-[11px] font-bold transition-colors ${custom ? "bg-fg text-canvas" : "text-muted hover:text-fg"}`}>Custom</button>
          </div>
        </div>

        {custom ? (
          <div className="mt-3">
            <input aria-label="Amount in naira" type="number" min={unitPriceNgn} step={1} inputMode="numeric" placeholder={`At least ₦${unitPriceNgn.toLocaleString("en-NG")}`} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
            <p className="mt-1.5 text-[11px] text-muted">The full amount goes to {firstName ?? "the creator"}, minus the platform fee shown at checkout.</p>
          </div>
        ) : (
          <p className="mt-2 text-[11.5px] text-muted">{qty} × ₦{unitPriceNgn.toLocaleString("en-NG")} = <b className="font-semibold text-fg">₦{total.toLocaleString("en-NG")}</b></p>
        )}

        <div className="mt-4 grid gap-2">
          <input aria-label="Your name" placeholder="Your name (optional)" maxLength={50} value={f.name} onChange={set("name")} className={field} />
          <input aria-label="Your email" type="email" required placeholder="Email — for your receipt" value={f.email} onChange={set("email")} className={field} />
          <textarea aria-label="Message" placeholder={`Leave a note for ${firstName ?? "the creator"}`} maxLength={280} rows={2} value={f.message} onChange={set("message")} className={field} />
        </div>

        <label className="mt-3 flex items-start gap-2 text-[11.5px] leading-snug text-muted">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} className="mt-0.5 accent-[#F0675A]" /> Show my note on the page
        </label>

        <button type="submit" className="mt-4 w-full rounded-xl bg-accent px-4 py-3 text-center font-extrabold text-on-accent shadow-[0_10px_24px_-14px_rgba(240,103,90,.9)] transition-[filter,transform] duration-150 hover:brightness-105 active:translate-y-px active:scale-[0.97] disabled:cursor-default">
          {busy ? <span className="inline-flex items-center justify-center gap-2"><Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> Opening checkout</span> : <>Send {custom ? "a custom amount" : `${qty} ${treat}${qty > 1 ? "s" : ""}`} for <span key={total} className="data inline-block motion-safe:animate-tick-up">₦{total.toLocaleString("en-NG")}</span></>}
        </button>
        <p className="mt-2 text-center text-[10.5px] text-muted">Paid securely in USDT via Roqqu · No account needed</p>
        {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
      </fieldset>
    </form>
  );
}
