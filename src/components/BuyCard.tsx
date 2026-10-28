"use client";
import { useState } from "react";

export type BuyCardProps = { treatName: string; treatImage: string; unitPriceNgn: number; presets: number[]; mode: "preview" | "live"; username?: string; onSend?: (qty: number) => void };

const field = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm";

/** The supporter-facing "send a treat" box. Preview mode draws the same card, inert; live mode posts to /api/checkout. */
export function BuyCard({ treatName, treatImage, unitPriceNgn, presets, mode, username, onSend }: BuyCardProps) {
  const [qty, setQty] = useState(presets[0] ?? 1);
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [f, setF] = useState({ name: "", email: "", message: "", isPublic: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const live = mode === "live";
  const total = custom ? Math.floor(Number(amount) || 0) : unitPriceNgn * qty;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

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
      if (r.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Couldn't reach the server. Please try again."); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-[18px] border border-line bg-surface p-4">
      <fieldset disabled={!live || busy} className="space-y-3 disabled:opacity-100">
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {treatImage ? <img src={treatImage} alt="" className="h-12 w-12" /> : null}
          <span className="text-sm">{treatName} x</span>
          {presets.map((n) => (
            <button key={n} type="button" aria-pressed={!custom && n === qty} onClick={() => { setCustom(false); setQty(n); }}
              className={`rounded-full border px-3 py-1 text-sm ${!custom && n === qty ? "border-fg bg-accent" : "border-line bg-surface-2"}`}>{n}</button>
          ))}
        </div>
        {!custom ? (
          <div className="flex items-center gap-3 text-sm">
            <button type="button" aria-label="Fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)} className="h-8 w-8 rounded-full border border-line bg-surface-2">-</button>
            <span data-testid="qty" className="w-8 text-center font-semibold">{qty}</span>
            <button type="button" aria-label="More" disabled={qty >= 50} onClick={() => setQty(qty + 1)} className="h-8 w-8 rounded-full border border-line bg-surface-2">+</button>
            <span className="data text-muted">₦{unitPriceNgn.toLocaleString("en-NG")} each</span>
          </div>
        ) : (
          <input aria-label="Amount in naira" type="number" min={unitPriceNgn} step={1} inputMode="numeric" placeholder={`At least ₦${unitPriceNgn.toLocaleString("en-NG")}`} value={amount} onChange={(e) => setAmount(e.target.value)} className={field} />
        )}
        <button type="button" onClick={() => setCustom(!custom)} className="text-xs underline">{custom ? "Back to treats" : "Choose an amount"}</button>
        <input aria-label="Your name" placeholder="Your name (optional)" maxLength={50} value={f.name} onChange={set("name")} className={field} />
        <input aria-label="Your email" type="email" required placeholder="Your email" value={f.email} onChange={set("email")} className={field} />
        <textarea aria-label="Message" placeholder="Leave a note" maxLength={280} rows={2} value={f.message} onChange={set("message")} className={field} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} /> Show my note on the page
        </label>
        <button type="submit" className="w-full rounded-xl bg-accent px-4 py-2 text-center font-semibold text-on-accent shadow-press disabled:cursor-default">
          {busy ? "One moment..." : `Send ${treatName} · ₦${total.toLocaleString("en-NG")}`}
        </button>
        <p className="text-center text-xs text-muted">Paid securely in USDT via Roqqu</p>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      </fieldset>
    </form>
  );
}
