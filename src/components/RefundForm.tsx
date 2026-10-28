"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefundForm({ pref }: { pref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [network, setNetwork] = useState("bep20");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`This sends real USDT on ${network.toUpperCase()} to ${address}. It cannot be undone. Continue?`)) return;
    setBusy(true); setMsg("");
    const r = await fetch(`/api/admin/payments/${encodeURIComponent(pref)}/refund`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address, network }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Something went wrong.");
    if (j.outcome === "unclear") setMsg("Refund sent — outcome unclear, check Roqqu");
    else router.refresh();
  }

  if (!open) return <button className="rounded-full border border-line px-3 py-1 text-xs font-semibold" onClick={() => setOpen(true)}>Refund</button>;
  return (
    <form onSubmit={submit} className="space-y-1">
      <input required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Supporter wallet address" className="w-full rounded-xl border border-line bg-surface-2 px-2 py-1 text-xs" />
      <select value={network} onChange={(e) => setNetwork(e.target.value)} className="rounded-xl border border-line bg-surface-2 px-2 py-1 text-xs">
        <option value="bep20">BEP20</option><option value="trc20">TRC20</option>
      </select>
      <p className="text-xs text-muted">USDT will be sent to this address, minus the network fee.</p>
      <button disabled={busy} className="rounded-full border border-line px-3 py-1 text-xs font-semibold disabled:opacity-50">Send refund</button>
      {msg && <p className="text-xs text-red-700">{msg}</p>}
    </form>
  );
}
