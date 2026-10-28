import type { Config } from "tailwindcss";

// "Ledger glass": deep ink canvas, teal for money that moved, coral for affection.
export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0F1433",
        surface: "#171E45",
        "surface-2": "#202859",
        fg: "#EEF0FF",
        muted: "#A1A8D4",
        line: "#2E3778",
        accent: "#33E0BE",
        "on-accent": "#062520",
        love: "#FF8197",
        "on-love": "#2A0811",
        warn: "#FFC15E",
        danger: "#FF6B78",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
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
        lift: "0 1px 0 rgba(255,255,255,.05) inset, 0 18px 40px -24px rgba(3,6,24,.9)",
      },
    },
  },
  plugins: [],
} satisfies Config;
