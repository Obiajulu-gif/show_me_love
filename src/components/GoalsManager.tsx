"use client";
import { Copy, Pause, Pencil, Play, Plus, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { formatMoney } from "@/lib/goalFormat";
import { GoalBar } from "./GoalBar";
import { BLANK_GOAL, GoalDrawer, type GoalFormValue } from "./GoalDrawer";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export type GoalRow = GoalFormValue & { id: string; slug: string; paused: boolean; raised: number | string; count: number };

export function GoalsManager({ goals, username, origin }: { goals: GoalRow[]; username: string; origin: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState<GoalFormValue | null>(null);
  const [copied, setCopied] = useState("");
  const [err, setErr] = useState("");

  async function copy(g: GoalRow) {
    const url = `${origin || window.location.origin}/@${username}/goals/${g.slug}`;
    try { await navigator.clipboard.writeText(url); setCopied(g.id); setTimeout(() => setCopied(""), 1500); } catch { setErr(`Copy this link: ${url}`); }
  }
  async function pause(g: GoalRow) {
    setErr("");
    const r = await fetch(`/api/goals/${g.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paused: !g.paused }) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Couldn't update the goal.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Your goals</h1>
        <Button onClick={() => setEditing(BLANK_GOAL)}><Plus size={16} /> New goal</Button>
      </div>
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}
      {goals.length === 0 ? (
        <Card className="text-center">
          <Target className="mx-auto text-muted" size={32} />
          <p className="mt-2 font-semibold">No goals yet</p>
          <p className="mt-1 text-sm text-muted">A goal gives people something specific to rally behind, like new gear or a trip. Start one and share its link.</p>
          <Button className="mt-4" onClick={() => setEditing(BLANK_GOAL)}>Create your first goal</Button>
        </Card>
      ) : (
        <ul className="space-y-4">
          {goals.map((g) => (
            <li key={g.id}>
              <Card className="flex flex-col gap-4 sm:flex-row">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {g.coverUrl ? <img src={g.coverUrl} alt="" className="h-24 w-full rounded-xl object-cover sm:w-36" /> : <div className="flex h-24 w-full items-center justify-center rounded-xl bg-line sm:w-36"><Target className="text-muted" /></div>}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate font-semibold">{g.title}</h2>
                    {g.paused && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">Paused</span>}
                  </div>
                  <GoalBar raised={g.raised} target={g.target} />
                  <p className="text-sm text-muted">{formatMoney(g.currency, g.raised)} of {formatMoney(g.currency, g.target)} · {g.count} {g.count === 1 ? "contribution" : "contributions"}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => copy(g)}><Copy size={14} /> {copied === g.id ? "Copied" : "Copy link"}</Button>
                    <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => setEditing(g)}><Pencil size={14} /> Edit</Button>
                    <Button variant="ghost" className="px-3 py-1 text-sm" onClick={() => pause(g)}>{g.paused ? <><Play size={14} /> Resume</> : <><Pause size={14} /> Pause</>}</Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && <GoalDrawer key={editing.id ?? "new"} initial={editing} defaultOrganizer={username} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}
