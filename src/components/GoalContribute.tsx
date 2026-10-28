"use client";
import { useState } from "react";

import { formatMoney, type GoalCurrency } from "@/lib/goalFormat";

const field = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm";

export function GoalContribute({ goalId, currency, suggested, paused }: { goalId: string; currency: GoalCurrency; suggested: number; paused: boolean }) {
  const [amount, setAmount] = useState(String(suggested));
  const [f, setF] = useState({ name: "", email: "", message: "", isPublic: true });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: "name" | "email" | "message") => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const n = Number(amount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/goals/${goalId}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: n, ...f }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.url) { window.location.assign(j.url); return; }
      setErr(j.error ?? "Something went wrong. Please try again.");
    } catch { setErr("Couldn't reach the server. Please try again."); }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-[18px] border border-line bg-surface p-4">
      <fieldset disabled={paused || busy} className="space-y-3">
        <label className="block text-sm font-semibold">Amount ({currency === "NGN" ? "₦" : "$"})
          <input type="number" required min={currency === "NGN" ? 100 : 1} step={currency === "NGN" ? "1" : "0.01"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className={`${field} mt-1 font-normal`} />
        </label>
        <input aria-label="Your name" placeholder="Your name (optional)" maxLength={50} value={f.name} onChange={set("name")} className={field} />
        <input aria-label="Your email" type="email" required placeholder="Your email" value={f.email} onChange={set("email")} className={field} />
        <textarea aria-label="Message" placeholder="Leave a note" maxLength={280} rows={2} value={f.message} onChange={set("message")} className={field} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isPublic} onChange={(e) => setF({ ...f, isPublic: e.target.checked })} /> Show my note on the page</label>
        <button type="submit" className="w-full rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent shadow-press disabled:cursor-not-allowed disabled:opacity-60">
          {paused ? "Goal paused" : busy ? "One moment..." : `Contribute ${Number.isFinite(n) && n > 0 ? formatMoney(currency, n) : ""}`.trim()}
        </button>
        {currency === "USD" && <p className="text-center text-xs text-muted">You pay in naira at today&apos;s rate; the goal counts dollars.</p>}
        <p className="text-center text-xs text-muted">Paid securely in USDT via Roqqu</p>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      </fieldset>
    </form>
  );
}
