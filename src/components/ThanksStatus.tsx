"use client";
import { Stamp } from "lucide-react";
import Link from "next/link";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { useCallback, useEffect, useState } from "react";

const FINAL = ["successful", "failed", "expired", "refunded"];
const TEN_MIN = 10 * 60_000;

/** Polls the payment every 3 s until it settles or 10 minutes pass. */
export function ThanksStatus({ ref_, username, initial, amountNgn, canSimulate, stampHref }: { ref_: string; username: string; initial: string; amountNgn: number; canSimulate: boolean; stampHref?: string | null }) {
  const [status, setStatus] = useState(initial);
  const [err, setErr] = useState("");
  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/payments/${ref_}`, { cache: "no-store" });
      if (r.ok) setStatus((await r.json()).status);
    } catch { /* keep the last status; try again on the next tick */ }
  }, [ref_]);

  useEffect(() => {
    if (FINAL.includes(status)) return;
    const started = Date.now();
    const id = setInterval(() => { if (Date.now() - started > TEN_MIN) clearInterval(id); else void poll(); }, 3000);
    return () => clearInterval(id);
  }, [status, poll]);

  async function simulate() {
    setErr("");
    const r = await fetch("/api/dev/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: ref_ }) });
    if (!r.ok) setErr("Couldn't simulate that payment.");
    await poll();
  }

  const back = <Link href={`/@${username}`} className="mt-6 inline-block underline">Back to @{username}</Link>;
  return (
    <div data-testid="thanks" data-status={status} className="rounded-[24px] border border-line bg-surface p-7 text-center shadow-paper-lift">
      {status === "successful" ? (
        <>
          <SuccessMark />
          <h1 className="mt-3 font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">Your love landed!</h1>
          <p className="mt-2 text-sm">₦{amountNgn.toLocaleString("en-NG")} is on its way to @{username}. Thank you for showing up.</p>
          {stampHref && (
            <Link href={stampHref} className="mt-6 block rounded-2xl border border-line bg-canvas p-4 text-left transition-colors hover:border-accent/50">
              <span className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent"><Stamp className="h-3.5 w-3.5" aria-hidden /> Keep the love going</span>
              <span className="mt-1 block font-display text-lg font-bold leading-tight text-fg">Make a support stamp for @{username}</span>
              <span className="mt-1 block text-sm text-muted">Put your photo on a stamp and share it with your people.</span>
            </Link>
          )}
        </>
      ) : status === "pending" ? (
        <>
          <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">Waiting for your payment</h1>
          <p className="mt-2 text-sm text-muted">Status: pending. This page updates on its own once the payment is confirmed.</p>
          {canSimulate && (
            <button type="button" onClick={simulate} className="mt-4 rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent shadow-press">Simulate payment</button>
          )}
          {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
        </>
      ) : (
        <>
          <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">This payment didn&apos;t go through</h1>
          <p className="mt-2 text-sm text-muted">Status: {status}. No treat was sent. You can try again from the page.</p>
        </>
      )}
      {back}
    </div>
  );
}
