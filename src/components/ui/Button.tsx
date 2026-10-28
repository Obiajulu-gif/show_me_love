import type { ButtonHTMLAttributes } from "react";

const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition-[transform,filter,box-shadow,border-color,opacity] duration-150 ease-out disabled:opacity-60";
const look = {
  primary: "bg-accent text-on-accent shadow-press hover:brightness-110 active:translate-y-px active:shadow-press-sm",
  ghost: "border border-line bg-surface-2 text-fg hover:border-accent/60",
};

export function buttonClass(variant: keyof typeof look = "primary", extra = "") {
  return `${base} ${look[variant]} ${extra}`.trim();
}

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof look }) {
  return <button {...p} className={buttonClass(variant, className)} />;
}
