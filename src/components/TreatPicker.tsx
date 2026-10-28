"use client";
import { ChevronDown, Gift, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import type { CatalogItem } from "@/lib/catalog";

export type TreatChoice = { treatId: string; customTreat?: { name: string; emoji: string } };

const tile = "relative flex flex-col items-center gap-1 rounded-xl border p-2 text-sm";

export function TreatPicker({ value, onChange }: { value: TreatChoice; onChange: (v: TreatChoice) => void }) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/treat-catalog").then((r) => r.json()).then((d) => setItems(d.treats ?? [])).catch(() => {});
  }, []);

  const pick = (id: string) => { onChange({ treatId: id }); setOpen(null); };
  const cls = (on: boolean) => `${tile} transition-[transform,background-color,border-color] duration-200 ease-out ${on ? "border-accent bg-accent/15 motion-safe:scale-[1.03]" : "border-line bg-surface-2 hover:border-muted/60 hover:bg-canvas"}`;
  const selectedIn = (t: CatalogItem) => value.treatId === t.id || t.children.some((c) => c.id === value.treatId);
  const custom = value.customTreat ?? { name: "", emoji: "" };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((t) => (
          <div key={t.id} className="relative">
            <button
              type="button"
              aria-pressed={selectedIn(t)}
              onClick={() => (t.children.length ? setOpen(open === t.id ? null : t.id) : pick(t.id))}
              className={`${cls(selectedIn(t))} w-full`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.image ? <img src={t.image} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Gift size={28} aria-hidden />}
              <span className="flex items-center gap-0.5">{t.name}{t.children.length > 0 && <ChevronDown size={14} />}</span>
            </button>
            {open === t.id && (
              <div className="absolute left-0 top-full z-10 mt-1 grid w-44 origin-top-left grid-cols-1 gap-1 rounded-xl border border-line bg-canvas p-2 shadow-lg motion-safe:animate-dialog-in">
                {t.children.map((c) => (
                  <button key={c.id} type="button" onClick={() => pick(c.id)} className={`flex items-center gap-2 rounded-lg px-2 py-1 text-left text-sm hover:bg-surface ${value.treatId === c.id ? "bg-accent/40" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.image && <img src={c.image} alt="" className="h-7 w-7 rounded-full object-cover" />}{c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button type="button" aria-pressed={value.treatId === "custom"} onClick={() => onChange({ treatId: "custom", customTreat: custom })} className={cls(value.treatId === "custom")}>
          <Plus size={28} /> Custom
        </button>
      </div>
      {value.treatId === "custom" && (
        <div className="mt-3 flex gap-2 motion-safe:animate-fade-in">
          <input aria-label="Treat name" maxLength={30} placeholder="Name your treat" value={custom.name} onChange={(e) => onChange({ treatId: "custom", customTreat: { ...custom, name: e.target.value } })} className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3 py-2" />
        </div>
      )}
    </div>
  );
}
