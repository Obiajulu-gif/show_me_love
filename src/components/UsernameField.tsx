"use client";
import { useEffect, useState } from "react";

/** Prefix + input + debounced (300 ms) availability check against /api/usernames. */
export function UsernameField({ value, onChange, onStatus }: { value: string; onChange: (v: string) => void; onStatus?: (ok: boolean) => void }) {
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    onStatus?.(false);
    if (!value) { setStatus(null); return; }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const d = await fetch(`/api/usernames?username=${encodeURIComponent(value)}`, { signal: ctl.signal }).then((r) => r.json());
        const ok = !!d.available;
        setStatus({ ok, text: ok ? "Available" : d.problem ?? d.error ?? "That username is taken." });
        onStatus?.(ok);
      } catch { /* aborted or offline */ }
    }, 300);
    return () => { clearTimeout(timer); ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div>
      <div className="flex items-center rounded-xl border border-line bg-white focus-within:border-cocoa-2">
        <span className="pl-3 text-cocoa-2">show-me-love/@</span>
        <input aria-label="Username" value={value} onChange={(e) => onChange(e.target.value.trim().toLowerCase())} maxLength={24} placeholder="yourname" autoCapitalize="none" autoComplete="off" className="min-w-0 flex-1 bg-transparent px-1 py-2 outline-none" />
      </div>
      <p aria-live="polite" className={`mt-1 min-h-5 text-sm ${status?.ok ? "text-green-700" : "text-cocoa-2"}`}>{status?.text}</p>
    </div>
  );
}
