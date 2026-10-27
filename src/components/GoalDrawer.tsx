"use client";
import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "./ui/Button";

export type GoalFormValue = {
  id?: string; title: string; story: string; coverUrl: string | null; currency: "NGN" | "USD"; target: number; suggested: number;
  showProgress: boolean; showTarget: boolean; organizerName: string | null; organizerPhoto: string | null;
  headerMode: "default" | "logo" | "hidden"; currencyLocked?: boolean;
};

const field = "w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
const HEADERS = [
  { id: "default", label: "show-me-love header" },
  { id: "logo", label: "My photo and name" },
  { id: "hidden", label: "No header" },
] as const;

export const BLANK_GOAL: GoalFormValue = {
  title: "", story: "", coverUrl: null, currency: "NGN", target: 100000, suggested: 2000, showProgress: true, showTarget: true,
  organizerName: null, organizerPhoto: null, headerMode: "default",
};

async function upload(file: File, kind: "avatar" | "cover"): Promise<string> {
  const fd = new FormData();
  fd.append("file", file); fd.append("kind", kind);
  const r = await fetch("/api/uploads", { method: "POST", body: fd });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Upload failed.");
  return j.url;
}

function Toggle({ label, help, on, set }: { label: string; help: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" role="switch" checked={on} onChange={(e) => set(e.target.checked)} className="mt-1 h-4 w-4 accent-[#F6C55A]" />
      <span><span className="block text-sm font-semibold">{label}</span><span className="block text-xs text-cocoa-2">{help}</span></span>
    </label>
  );
}

/** Slide-over form for creating or editing a goal. Calls onSaved after the API accepts it. */
export function GoalDrawer({ initial, defaultOrganizer, onClose, onSaved }: { initial: GoalFormValue; defaultOrganizer: string; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState(initial);
  const [target, setTarget] = useState(String(initial.target));
  const [suggested, setSuggested] = useState(String(initial.suggested));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof GoalFormValue>(k: K, v: GoalFormValue[K]) => setF((p) => ({ ...p, [k]: v }));
  const organizer = f.organizerName?.trim() || defaultOrganizer;

  async function pick(kind: "avatar" | "cover", file: File | undefined) {
    if (!file) return;
    setErr("");
    try { const url = await upload(file, kind); set(kind === "cover" ? "coverUrl" : "organizerPhoto", url); } catch (e) { setErr(e instanceof Error ? e.message : "Upload failed."); }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    const { id: _id, currencyLocked: _locked, ...rest } = f;
    void _id; void _locked;
    const body = { ...rest, target: Number(target), suggested: Number(suggested) };
    try {
      const r = await fetch(initial.id ? `/api/goals/${initial.id}` : "/api/goals", {
        method: initial.id ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { onSaved(); return; }
      setErr(j.error ?? "Couldn't save the goal.");
    } catch { setErr("Couldn't reach the server. Please try again."); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-cocoa/40" role="dialog" aria-modal="true" aria-label={initial.id ? "Edit goal" : "New goal"}>
      <form onSubmit={save} className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-cream p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-2xl italic">{initial.id ? "Edit goal" : "New goal"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 hover:bg-cream-2"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <label className="block text-sm font-semibold">Title
            <input required minLength={3} maxLength={80} value={f.title} onChange={(e) => set("title", e.target.value)} className={`${field} mt-1 font-normal`} placeholder="Help me buy a camera" />
          </label>
          <label className="block text-sm font-semibold">Story
            <textarea maxLength={2000} rows={4} value={f.story} onChange={(e) => set("story", e.target.value)} className={`${field} mt-1 font-normal`} placeholder="Tell people what this goal is for." />
          </label>
          <div className="text-sm font-semibold">Cover image
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.coverUrl && <img src={f.coverUrl} alt="" className="mt-1 h-28 w-full rounded-xl object-cover" />}
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Cover image" onChange={(e) => void pick("cover", e.target.files?.[0])} className="mt-1 block w-full text-xs font-normal" />
          </div>
          <label className="block text-sm font-semibold">Currency
            <select value={f.currency} disabled={!!f.currencyLocked} onChange={(e) => set("currency", e.target.value as "NGN" | "USD")} className={`${field} mt-1 font-normal`}>
              <option value="NGN">Naira (₦)</option>
              <option value="USD">US dollars ($)</option>
            </select>
            {f.currencyLocked && <span className="mt-1 block text-xs font-normal text-cocoa-2">Currency locks when the first checkout starts.</span>}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-semibold">Target
              <input required type="number" min={f.currency === "USD" ? 0.01 : 1} step={f.currency === "USD" ? "0.01" : "1"} value={target} onChange={(e) => setTarget(e.target.value)} className={`${field} mt-1 font-normal`} />
            </label>
            <label className="block text-sm font-semibold">Suggested contribution
              <input required type="number" min={f.currency === "USD" ? 1 : 100} step={f.currency === "USD" ? "0.01" : "1"} value={suggested} onChange={(e) => setSuggested(e.target.value)} className={`${field} mt-1 font-normal`} />
            </label>
          </div>
          <Toggle label="Show progress" help="Supporters see how much has been raised and who chipped in." on={f.showProgress} set={(v) => set("showProgress", v)} />
          <Toggle label="Show target" help="Display the amount you are aiming for beside the progress bar." on={f.showTarget} set={(v) => set("showTarget", v)} />
          <fieldset className="space-y-2 rounded-xl border border-line p-3">
            <legend className="px-1 text-sm font-semibold">Goal organizer</legend>
            <input aria-label="Organizer name" maxLength={60} placeholder={defaultOrganizer} value={f.organizerName ?? ""} onChange={(e) => set("organizerName", e.target.value || null)} className={field} />
            <input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Organizer photo" onChange={(e) => void pick("avatar", e.target.files?.[0])} className="block w-full text-xs" />
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-xs" data-testid="organizer-chip">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {f.organizerPhoto && <img src={f.organizerPhoto} alt="" className="h-5 w-5 rounded-full object-cover" />}
              A goal by {organizer}
            </span>
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="text-sm font-semibold">Goal header</legend>
            {HEADERS.map((h) => (
              <label key={h.id} className="flex items-center gap-2 text-sm">
                <input type="radio" name="header" checked={f.headerMode === h.id} onChange={() => set("headerMode", h.id)} /> {h.label}
              </label>
            ))}
          </fieldset>
          <p className="rounded-xl bg-cream-2 p-3 text-xs text-cocoa-2">Supporters choose their own amount, starting from your suggestion. Money counts toward the goal once the payment clears.</p>
          {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save goal"}</Button>
        </div>
      </form>
    </div>
  );
}
