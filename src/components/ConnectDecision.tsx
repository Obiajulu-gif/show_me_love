"use client";
import { useState } from "react";

export function ConnectDecision({ req }: { req: string }) {
  const [earnings, setEarnings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "allow" | "deny") {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/connect/authorize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ req, decision, earnings: decision === "allow" && earnings }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && typeof d.redirect === "string") return void window.location.assign(d.redirect);
      setErr(d.error ?? "Something went wrong.");
    } catch {
      setErr("Couldn't reach the server. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="mt-5 space-y-4">
      <ul className="space-y-2 text-sm text-fg">
        <li className="flex items-center gap-2"><input type="checkbox" checked disabled aria-label="Your public page link (always shared)" /> Your public page link</li>
        <li><label className="flex items-center gap-2"><input type="checkbox" checked={earnings} onChange={(e) => setEarnings(e.target.checked)} /> Your earnings</label></li>
      </ul>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      <div className="flex gap-3">
        <button disabled={busy} onClick={() => decide("allow")} className="flex-1 rounded-xl bg-accent px-4 py-2 font-semibold text-on-accent shadow-press disabled:opacity-60">Allow</button>
        <button disabled={busy} onClick={() => decide("deny")} className="flex-1 rounded-xl border border-line bg-surface-2 px-4 py-2 font-semibold text-fg hover:bg-canvas disabled:opacity-60">Deny</button>
      </div>
    </div>
  );
}
