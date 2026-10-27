import type { ButtonHTMLAttributes } from "react";

const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold transition disabled:opacity-60";
const look = {
  primary: "bg-honey text-honey-ink shadow-[0_4px_0_#3B2416] active:translate-y-[2px] active:shadow-[0_2px_0_#3B2416]",
  ghost: "border border-line bg-white text-cocoa hover:bg-cream-2",
};

export function buttonClass(variant: keyof typeof look = "primary", extra = "") {
  return `${base} ${look[variant]} ${extra}`.trim();
}

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof look }) {
  return <button {...p} className={buttonClass(variant, className)} />;
}
