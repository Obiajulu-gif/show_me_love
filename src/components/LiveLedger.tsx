"use client";

import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

/** Example settlements, shown as a ledger: the hero's one moving part. Not real activity. */
const ROWS = [
  { img: "zobo", to: "ada_bakes", treat: "Zobo", qty: 3, ngn: 1500, usdt: "1.00", net: "BEP20", tx: "0x8f3a…c21e" },
  { img: "suya", to: "tobi.codes", treat: "Suya", qty: 2, ngn: 2400, usdt: "1.60", net: "TRC20", tx: "TQ9x…v7Lm" },
  { img: "coffee", to: "kemi_draws", treat: "Coffee", qty: 1, ngn: 1200, usdt: "0.80", net: "BEP20", tx: "0x1b77…9a04" },
  { img: "jollof", to: "lagos_lens", treat: "Jollof", qty: 4, ngn: 6000, usdt: "4.00", net: "TRC20", tx: "TFk2…pQ8s" },
  { img: "malt", to: "chidi_plays", treat: "Malt", qty: 5, ngn: 2500, usdt: "1.67", net: "BEP20", tx: "0xa45d…07be" },
];

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function LiveLedger() {
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setShown(ROWS.length);
    const t = setInterval(() => setShown((n) => (n >= ROWS.length ? n : n + 1)), 900);
    return () => clearInterval(t);
  }, []);

  return (
    <figure className="w-full overflow-hidden rounded-2xl border border-line bg-surface/70 shadow-lift backdrop-blur">
      <figcaption className="flex items-center justify-between border-b border-line px-5 py-3 text-sm">
        <span className="font-semibold">Treats settling</span>
        <span className="inline-flex items-center gap-2 text-muted">
          <span className="h-2 w-2 rounded-full bg-accent motion-safe:animate-pulse" aria-hidden="true" />
          Example activity
        </span>
      </figcaption>
      <ol className="divide-y divide-line" aria-live="polite">
        {ROWS.slice(0, shown).map((r) => (
          <li key={r.tx} className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-5 py-3 motion-safe:animate-[ledger-in_.5s_ease-out]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/treats/${r.img}.webp`} alt="" className="row-span-2 h-10 w-10 rounded-full object-cover ring-1 ring-line" />
            <span className="truncate">
              <Heart size={14} className="mr-1 inline fill-love text-love align-[-2px]" aria-hidden />{r.qty} {r.treat} to <span className="font-semibold">@{r.to}</span>
            </span>
            <span className="data text-right font-medium text-accent">+{r.usdt} USDT</span>
            <span className="data truncate text-xs text-muted">{r.tx}</span>
            <span className="text-right text-xs text-muted">
              <span className="data">{naira(r.ngn)}</span> on {r.net}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
