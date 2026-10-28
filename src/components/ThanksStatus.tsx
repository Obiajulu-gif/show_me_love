"use client";
import Link from "next/link";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { useCallback, useEffect, useState } from "react";

const FINAL = ["successful", "failed", "expired", "refunded"];
const TEN_MIN = 10 * 60_000;

/** Polls the payment every 3 s until it settles or 10 minutes pass. */
export function ThanksStatus({ ref_, username, initial, amountNgn, canSimulate }: { ref_: string; username: string; initial: string; amountNgn: number; canSimulate: boolean }) {
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
    <div data-testid="thanks" data-status={status} className="rounded-[18px] border border-line bg-canvas p-6 text-center">
      {status === "successful" ? (
        <>
          <SuccessMark />
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Your love landed!</h1>
          <p className="mt-2 text-sm">₦{amountNgn.toLocaleString("en-NG")} is on its way to @{username}. Thank you for showing up.</p>
        </>
      ) : status === "pending" ? (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Waiting for your payment</h1>
          <p className="mt-2 text-sm text-muted">Status: pending. This page updates on its own once the payment is confirmed.</p>
          {canSimulate && (
            <button type="button" onClick={simulate} className="mt-4 rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent shadow-press">Simulate payment</button>
          )}
          {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold tracking-tight">This payment didn&apos;t go through</h1>
          <p className="mt-2 text-sm text-muted">Status: {status}. No treat was sent. You can try again from the page.</p>
        </>
      )}
      {back}
    </div>
  );
}
