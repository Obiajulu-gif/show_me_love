import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cream: "#FFF9EE",
        "cream-2": "#F6EEDF",
        cocoa: "#3B2416",
        "cocoa-2": "#7A4A2E",
        honey: "#F6C55A",
        "honey-ink": "#2B1A0E",
        line: "#EADCC6",
      },
      fontFamily: {
        sans: "var(--font-sans)",
        serif: "var(--font-serif)",
      },
    },
  },
  plugins: [],
} satisfies Config;
