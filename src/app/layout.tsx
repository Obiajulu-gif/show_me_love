import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const appUrl = process.env.PUBLIC_APP_URL ?? "https://show-me-love.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "show-me-love — small treats, real support",
    template: "%s · show-me-love",
  },
  description: "One link for zobo, suya, jollof or your own treat. Your people support you in naira; you get paid in USDT and withdraw to your bank or wallet.",
  applicationName: "show-me-love",
  openGraph: {
    type: "website",
    siteName: "show-me-love",
    title: "show-me-love — small treats, real support",
    description: "One link for zobo, suya, jollof or your own treat. Your people support you in naira; you get paid in USDT and withdraw to your bank or wallet.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "show-me-love — small treats, real support",
    description: "One link for zobo, suya, jollof or your own treat. Your people support you in naira; you get paid in USDT and withdraw to your bank or wallet.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
