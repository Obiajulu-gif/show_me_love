import type { ButtonHTMLAttributes } from "react";

const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-[transform,filter,box-shadow,border-color,opacity] duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";
const look = {
  primary: "bg-accent text-on-accent shadow-press hover:brightness-110 active:translate-y-px active:shadow-press-sm disabled:bg-surface-2 disabled:text-muted disabled:shadow-none",
  ghost: "border border-line bg-surface-2 text-fg hover:border-accent/60 disabled:opacity-50",
};

export function buttonClass(variant: keyof typeof look = "primary", extra = "") {
  return `${base} ${look[variant]} ${extra}`.trim();
}

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof look }) {
  return <button {...p} className={buttonClass(variant, className)} />;
}
