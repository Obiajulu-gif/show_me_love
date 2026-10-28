"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = { id: string; method: string; status: string };

export function AdminActions({ w }: { w: Row }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(body: Record<string, string>) {
    setBusy(true);
    setMsg("");
    const r = await fetch(`/api/admin/withdrawals/${w.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    if (j.status === "failed") setMsg("Payout failed: nothing was sent and the money went back to the creator. Admins were emailed.");
    else if (j.stuck) setMsg("Sent, but the outcome is unclear. Admins were emailed to reconcile.");
    router.refresh();
  }
  const ask = (q: string) => (window.prompt(q) ?? "").trim();
  const btn = "rounded-full border border-line px-3 py-1 text-xs font-semibold disabled:opacity-50";

  const stuck = w.status === "processing";
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        {!stuck && w.method === "usdt" && (
          <button className={btn} disabled={busy} onClick={() => window.confirm("Send this USDT now?") && run({ action: "approve" })}>Approve and send</button>
        )}
        {!stuck && w.method === "ngn_bank" && (
          <button className={btn} disabled={busy} onClick={() => { const bankReference = ask("Bank transfer reference (after you have paid them):"); if (bankReference) run({ action: "paid", bankReference }); }}>Mark paid</button>
        )}
        {!stuck && (
          <button className={btn} disabled={busy} onClick={() => { const note = ask("Why reject? The balance goes back to the creator."); if (note) run({ action: "reject", note }); }}>Reject</button>
        )}
        {stuck && (
          <>
            <button className={btn} disabled={busy} onClick={() => { const note = ask("It WAS sent. What did you check (e.g. tx hash)?"); if (note) run({ action: "stuck_paid", note }); }}>Mark sent</button>
            <button className={btn} disabled={busy} onClick={() => {
              if (!window.confirm("I verified the USDT was NOT sent. Return the held amount to the creator's balance?")) return;
              const note = ask("What did you check to confirm it was not sent?");
              if (note) run({ action: "stuck_release", note });
            }}>Not sent, release</button>
          </>
        )}
      </div>
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </div>
  );
}
