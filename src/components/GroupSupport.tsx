"use client";
import { Plus, X } from "lucide-react";
import { SuccessMark } from "@/components/ui/SuccessMark";
import { useCallback, useEffect, useState } from "react";

import { parseUsernames } from "@/lib/groupNames";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Tabs } from "./ui/Tabs";

type Chip = { username: string; displayName: string | null; photoUrl: string | null };
type Hist = { ref: string; status: string; total: number; currency: "NGN" | "USD"; members: string[]; createdAt: string };
type Thanks = { ref: string; status: string; total: number; currency: "NGN" | "USD" };

const money = (n: number, c: string) => (c === "NGN" ? `₦${n.toLocaleString("en-NG")}` : `$${n.toFixed(2)}`);
const FINAL = ["successful", "failed", "expired", "refunded"];
const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

function ThanksPanel({ thanks, canSimulate }: { thanks: Thanks; canSimulate: boolean }) {
  const [status, setStatus] = useState(thanks.status);
  const [err, setErr] = useState("");
  const poll = useCallback(async () => {
    try { const r = await fetch(`/api/payments/${thanks.ref}`, { cache: "no-store" }); if (r.ok) setStatus((await r.json()).status); } catch { /* try next tick */ }
  }, [thanks.ref]);
  useEffect(() => {
    if (FINAL.includes(status)) return;
    const id = setInterval(() => void poll(), 3000);
    return () => clearInterval(id);
  }, [status, poll]);
  async function simulate() {
    setErr("");
    const r = await post("/api/dev/simulate", { ref: thanks.ref });
    if (!r.ok) setErr("Couldn't simulate that payment.");
    await poll();
  }
  return (
    <Card data-testid="group-thanks" data-status={status} className="text-center">
      {status === "successful" ? (
        <><SuccessMark /><h2 className="mt-2 font-display text-2xl font-semibold tracking-tight">Your group got your love!</h2>
          <p className="mt-1 text-sm">{money(thanks.total, thanks.currency)} is on its way to everyone in the group.</p></>
      ) : status === "pending" ? (
        <><h2 className="font-display text-2xl font-semibold tracking-tight">Waiting for your payment</h2>
          <p className="mt-1 text-sm text-muted">Status: pending. This updates on its own once it is confirmed.</p>
          {canSimulate && <Button type="button" onClick={simulate} className="mt-4">Simulate payment</Button>}
          {err && <p role="alert" className="mt-2 text-sm text-danger">{err}</p>}</>
      ) : (
        <><h2 className="font-display text-2xl font-semibold tracking-tight">This payment didn&apos;t go through</h2>
          <p className="mt-1 text-sm text-muted">Status: {status}. Nobody was paid. You can start again below.</p></>
      )}
    </Card>
  );
}

export function GroupSupport({ history, thanks, canSimulate }: { history: Hist[]; thanks: Thanks | null; canSimulate: boolean }) {
  const [tab, setTab] = useState<"add" | "history">("add");
  const [text, setText] = useState("");
  const [chips, setChips] = useState<Chip[]>([]);
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [total, setTotal] = useState("");
  const [mode, setMode] = useState<"even" | "custom">("even");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setErr("");
    const names = parseUsernames(text).filter((n) => !chips.some((c) => c.username.toLowerCase() === n));
    if (!names.length) return;
    const r = await post("/api/groups/check", { usernames: names });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(j.error ?? "Couldn't check those names.");
    setChips((cur) => [...cur, ...(j.ok as Chip[]).filter((c) => !cur.some((x) => x.username === c.username))].slice(0, 10));
    setErr(j.missing?.length ? `We couldn't find ${j.missing.map((m: string) => `@${m}`).join(", ")}.` : "");
    setText(j.missing?.join(", ") ?? "");
  }

  const totalNum = Number(total);
  const sum = chips.reduce((a, c) => a + Math.round((Number(custom[c.username]) || 0) * 100), 0);
  const even = chips.length && totalNum > 0 ? totalNum / chips.length : 0;
  const customOk = mode === "even" || sum === Math.round(totalNum * 100);

  async function pay() {
    setErr("");
    if (!customOk) return setErr("Split amounts must add up to the total.");
    setBusy(true);
    const split = mode === "even" ? "even" : { custom: Object.fromEntries(chips.map((c) => [c.username, Number(custom[c.username]) || 0])) };
    const r = await post("/api/groups", { usernames: chips.map((c) => c.username), currency, total: totalNum, split, message: message || undefined, isPublic });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Something went wrong. Try again.");
    window.location.href = j.url;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Group support</p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">Support a group</h1>
      </div>
      {thanks && <ThanksPanel thanks={thanks} canSimulate={canSimulate} />}
      <Tabs label="Group support" value={tab} onChange={setTab} tabs={[{ id: "add", label: "Add support" }, { id: "history", label: "History" }]} />
      {tab === "history" ? (
        history.length === 0 ? <Card className="text-center text-sm text-muted">No group payments yet.</Card> : (
          <ul className="space-y-3">
            {history.map((h) => (
              <li key={h.ref}>
                <Card className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm">
                  <div>
                    <p className="font-semibold">{money(h.total, h.currency)} <span className="font-normal capitalize text-muted">· {h.status}</span></p>
                    <p className="text-muted">{h.members.map((m) => `@${m}`).join(", ")}</p>
                  </div>
                  <time className="text-muted">{new Date(h.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</time>
                </Card>
              </li>
            ))}
          </ul>
        )
      ) : (
        <Card className="space-y-5">
          <p className="text-sm text-muted">Add 2 to 10 creators, then choose how to split one payment.</p>
          <form onSubmit={(e) => { e.preventDefault(); void add(); }} className="flex gap-2">
            <input aria-label="Usernames" value={text} onChange={(e) => setText(e.target.value)} placeholder="@username, another_name" className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2" />
            <Button type="submit" variant="ghost"><Plus size={16} /> Add</Button>
          </form>
          {chips.length === 0 ? <p className="text-sm text-muted">Add a username to start your group.</p> : (
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.username} className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2 text-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent">{c.username[0].toUpperCase()}</span>}
                  <span>{c.displayName || c.username}</span>
                  <button type="button" aria-label={`Remove ${c.username}`} onClick={() => setChips(chips.filter((x) => x !== c))}><X size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Currency
              <select value={currency} onChange={(e) => setCurrency(e.target.value as "NGN" | "USD")} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-normal">
                <option value="NGN">NGN (₦)</option><option value="USD">USD ($)</option>
              </select>
            </label>
            <label className="text-sm font-semibold">Total
              <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={currency === "NGN" ? "1000" : "10.00"} className="mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-normal" />
            </label>
          </div>
          <fieldset className="space-y-2 text-sm">
            <legend className="font-semibold">Split settings</legend>
            {(["even", "custom"] as const).map((m) => (
              <label key={m} className="mr-4 inline-flex items-center gap-2"><input type="radio" name="split" checked={mode === m} onChange={() => setMode(m)} />{m === "even" ? "Even" : "Custom"}</label>
            ))}
            {mode === "custom" && chips.map((c) => (
              <label key={c.username} className="flex items-center justify-between gap-3">@{c.username}
                <input inputMode="decimal" aria-label={`Amount for ${c.username}`} value={custom[c.username] ?? ""} onChange={(e) => setCustom({ ...custom, [c.username]: e.target.value })} className="w-32 rounded-xl border border-line bg-surface-2 px-3 py-1.5" />
              </label>
            ))}
            {mode === "custom" && <p className={customOk ? "text-muted" : "text-danger"}>Entered {money(sum / 100, currency)} of {money(totalNum || 0, currency)}</p>}
          </fieldset>
          <textarea aria-label="Message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} placeholder="A message (optional)" className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />Show my message publicly</label>
          {chips.length > 0 && totalNum > 0 && (
            <div className="rounded-xl bg-surface-2 p-3 text-sm" aria-label="Confirm">
              <p className="font-semibold">You are paying {money(totalNum, currency)} to:</p>
              <ul className="mt-1">
                {chips.map((c) => <li key={c.username} className="flex justify-between"><span>@{c.username}</span><span>{money(mode === "even" ? even : Number(custom[c.username]) || 0, currency)}</span></li>)}
              </ul>
            </div>
          )}
          {err && <p role="alert" className="text-sm text-danger">{err}</p>}
          <Button type="button" onClick={pay} disabled={busy || chips.length < 2 || !(totalNum > 0)} className="w-full">{busy ? "Starting checkout…" : "Pay"}</Button>
        </Card>
      )}
    </div>
  );
}
