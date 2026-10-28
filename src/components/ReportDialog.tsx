"use client";

import { useRef, useState } from "react";

const REASONS = [
  ["spam", "Spam or junk"],
  ["impersonation", "Pretending to be someone else"],
  ["scam", "Looks like a scam"],
  ["inappropriate", "Content that should not be here"],
  ["other", "Something else"],
] as const;
const field = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm";

export function ReportDialog({ username }: { username: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/reports", { method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, reason: f.get("reason"), details: f.get("details"), reporterEmail: f.get("email") }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setDone(true); setMsg(""); } else setMsg(j.error ?? "Something went wrong.");
  }

  return (
    <>
      <button type="button" className="underline" onClick={() => { setDone(false); setMsg(""); ref.current?.showModal(); }}>Report page</button>
      <dialog ref={ref} className="w-[min(92vw,26rem)] rounded-[18px] border border-line bg-canvas p-5 text-left text-fg backdrop:bg-canvas/75 backdrop:backdrop-blur-sm open:motion-safe:animate-dialog-in">
        {done ? (
          <div className="space-y-3"><p>Thanks. We will take a look.</p><button type="button" className="underline" onClick={() => ref.current?.close()}>Close</button></div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <h2 className="font-display text-xl font-semibold tracking-tight">Report @{username}</h2>
            <select name="reason" required defaultValue="" className={field}>
              <option value="" disabled>Why are you reporting this page?</option>
              {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <textarea name="details" maxLength={1000} rows={4} placeholder="Anything we should know? (optional)" className={field} />
            <input name="email" type="email" placeholder="Your email, if you want a reply (optional)" className={field} />
            {msg && <p className="text-sm text-danger">{msg}</p>}
            <div className="flex gap-3">
              <button className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent shadow-press">Send report</button>
              <button type="button" className="underline" onClick={() => ref.current?.close()}>Cancel</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
