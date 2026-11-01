"use client";

import { useRef, useState, type KeyboardEvent } from "react";

import { heatmap, nextDay } from "@/lib/heatmap";

const SHADES = ["bg-surface-2", "bg-mint/25", "bg-mint/55", "bg-mint"];
const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const text = (n: number) => (n === 0 ? "No treats this day." : n === 1 ? "1 treat" : `${n} treats`);
const COLS = { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" };

/** Last 12 weeks of public support. One tab stop (roving tabindex); arrows move by week/day. */
export function SupportHeatmap({ dates, today = new Date() }: { dates: Date[]; today?: Date }) {
  const { weeks, months } = heatmap(dates, today);
  const flat = weeks.flat();
  const last = flat.findLastIndex((c) => !c.future);
  const [active, setActive] = useState(last);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const empty = flat.every((c) => c.count === 0);

  const onKey = (e: KeyboardEvent) => {
    const n = nextDay(active, e.key, last);
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setActive(n);
    refs.current[n]?.focus();
  };

  return (
    <section className="mt-6 rounded-[20px] border border-line bg-surface p-5 text-fg shadow-paper">
      <h2 className="font-display text-lg font-semibold tracking-tight">Recent support</h2>
      <p className="text-sm text-muted">The last 12 weeks</p>
      <div aria-hidden className="mt-3 grid gap-1" style={COLS}>
        {weeks.map((_, c) => <span key={c} className="h-4 text-xs text-muted">{months.find((m) => m.col === c)?.label}</span>)}
      </div>
      <div role="grid" aria-label="Support in the last 12 weeks" onKeyDown={onKey} className="mt-1 grid gap-1" style={COLS}>
        {weeks.map((w, c) => (
          <div key={c} role="row" className="grid gap-1">
            {w.map((cell, d) => {
              const i = c * 7 + d;
              if (cell.future) return <span key={cell.date} aria-hidden className="aspect-square" />;
              const pos = c < 3 ? "left-0" : c >= 9 ? "right-0" : "left-1/2 -translate-x-1/2";
              return (
                <span key={cell.date} ref={(el) => { refs.current[i] = el; }} role="gridcell" tabIndex={i === active ? 0 : -1}
                  aria-label={`${fmt(cell.date)}: ${text(cell.count)}`} onFocus={() => setActive(i)}
                  className={`group relative aspect-square rounded-[4px] border border-line ${SHADES[cell.level]} focus:outline focus:outline-2 focus:outline-accent`}>
                  <span aria-hidden className={`pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-[10rem] rounded-md bg-fg px-2 py-1 text-xs text-canvas group-hover:block group-focus:block ${pos}`}>
                    <b className="block">{fmt(cell.date)}</b>{text(cell.count)}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {empty && <p className="mt-3 text-sm text-muted">Treats will show up here.</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>Days shown in UTC</span>
        <span className="flex items-center gap-1">Fewer {SHADES.map((s) => <i key={s} className={`h-3 w-3 rounded-[3px] border border-line ${s}`} />)} More</span>
      </div>
    </section>
  );
}
