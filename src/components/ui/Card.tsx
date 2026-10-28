import type { HTMLAttributes } from "react";

export function Card({ className = "", ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={`rounded-2xl border border-line bg-surface/80 p-6 shadow-lift backdrop-blur ${className}`} />;
}
