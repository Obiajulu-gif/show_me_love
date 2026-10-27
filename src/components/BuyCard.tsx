"use client";
import { useState } from "react";

export type BuyCardProps = { treatName: string; treatImage: string; unitPriceNgn: number; presets: number[]; mode: "preview" | "live"; onSend?: (qty: number) => void };

/** The supporter-facing "send a treat" box. Quantity is local state; checkout is wired in by the public page. */
export function BuyCard({ treatName, treatImage, unitPriceNgn, presets, mode, onSend }: BuyCardProps) {
  const [picked, setPicked] = useState(1);
  const idx = Math.min(picked, presets.length - 1);
  const qty = presets[idx] ?? 1;
  return (
    <div className="mt-4 rounded-[18px] border border-line bg-cream-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {treatImage ? <img src={treatImage} alt="" className="h-12 w-12" /> : null}
        <span className="text-sm">{treatName} x</span>
        {presets.map((n, i) => (
          <button key={n} type="button" aria-pressed={i === idx} onClick={() => setPicked(i)}
            className={`rounded-full border px-3 py-1 text-sm ${i === idx ? "border-cocoa bg-honey" : "border-line bg-white"}`}>{n}</button>
        ))}
      </div>
      <button type="button" disabled={mode === "preview"} onClick={() => onSend?.(qty)}
        className="mt-3 w-full rounded-xl bg-honey px-4 py-2 text-center font-semibold text-honey-ink shadow-[0_4px_0_#3B2416] disabled:cursor-default">
        Send ₦{(unitPriceNgn * qty).toLocaleString("en-NG")}
      </button>
    </div>
  );
}
