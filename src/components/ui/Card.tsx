import type { HTMLAttributes } from "react";

export function Card({ className = "", ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`rounded-[18px] border border-line bg-cream-2 p-6 ${className}`} />;
}
