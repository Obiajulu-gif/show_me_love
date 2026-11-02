import type { Config } from "tailwindcss";

// Two surfaces, one product: warm paper for the shopfront, warm espresso for the ledger.
// Tokens are CSS variables so a route can switch surfaces without forking components.
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)",
        love: "rgb(var(--love) / <alpha-value>)",
        "on-love": "rgb(var(--on-love) / <alpha-value>)",
        warn: "rgb(var(--warn) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
        coral: "rgb(var(--coral) / <alpha-value>)",
        "on-coral": "rgb(var(--on-coral) / <alpha-value>)",
        mint: "rgb(var(--mint) / <alpha-value>)",
        "on-mint": "rgb(var(--on-mint) / <alpha-value>)",
        green: "rgb(var(--green) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      // Motion: short, transform/opacity only, each one explains a state change.
      transitionTimingFunction: { out: "cubic-bezier(.16,1,.3,1)" },
      keyframes: {
        "dialog-in": { from: { opacity: "0", transform: "translateY(8px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
        "drawer-in": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "none" } },
        "scrim-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { "0%": { opacity: "0", transform: "scale(.6)" }, "70%": { opacity: "1", transform: "scale(1.08)" }, "100%": { transform: "scale(1)" } },
        "check-draw": { from: { strokeDashoffset: "24" }, to: { strokeDashoffset: "0" } },
        "tick-up": { from: { opacity: "0", transform: "translateY(40%)" }, to: { opacity: "1", transform: "none" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
      },
      animation: {
        "dialog-in": "dialog-in .22s cubic-bezier(.16,1,.3,1)",
        "drawer-in": "drawer-in .26s cubic-bezier(.16,1,.3,1)",
        "scrim-in": "scrim-in .2s ease-out",
        "pop-in": "pop-in .45s cubic-bezier(.16,1,.3,1) both",
        "check-draw": "check-draw .4s .25s cubic-bezier(.16,1,.3,1) both",
        "tick-up": "tick-up .2s cubic-bezier(.16,1,.3,1)",
        "fade-in": "fade-in .15s ease-out",
      },
      boxShadow: {
        press: "0 0 0 1px rgba(255,255,255,.14) inset, 0 8px 24px -6px rgba(51,224,190,.45)",
        "press-sm": "0 0 0 1px rgba(255,255,255,.14) inset, 0 3px 10px -4px rgba(51,224,190,.45)",
        lift: "0 1px 0 rgba(255,255,255,.04) inset, 0 18px 40px -24px rgba(0,0,0,.85)",
        paper: "0 24px 60px -42px rgba(40,25,10,.5)",
        "paper-lift": "0 40px 90px -58px rgba(40,25,10,.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
