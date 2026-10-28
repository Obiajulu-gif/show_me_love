"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function RevokeAppButton({ appId, name }: { appId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} aria-label={`Revoke ${name}`} className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm font-semibold text-fg hover:bg-surface disabled:opacity-60"
      onClick={async () => {
        setBusy(true);
        try { await fetch("/api/connect/revoke", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ appId }) }); } catch { /* the list stays; try again */ }
        setBusy(false);
        router.refresh();
      }}>Revoke</button>
  );
}
