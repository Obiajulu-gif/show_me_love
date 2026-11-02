import Link from "next/link";

import { Logo } from "./Logo";
import { buttonClass } from "./ui/Button";

export function NotFoundPage({
  title = "This page took a wrong turn.",
  body = "The link may be old, or the page may have moved. Your people are still out there.",
  primaryHref = "/",
  primaryLabel = "Back to show-me-love",
  secondaryHref = "/signup",
  secondaryLabel = "Create your page",
}: {
  title?: string;
  body?: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-16 text-center text-fg">
      <Logo />
      <p className="mt-10 font-mono text-xs uppercase tracking-[0.18em] text-accent">404 · page not found</p>
      <h1 className="mt-3 max-w-lg font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-5xl">{title}</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{body}</p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Link href={primaryHref} className={buttonClass("primary", "rounded-full px-5 py-2.5")}>{primaryLabel}</Link>
        <Link href={secondaryHref} className={buttonClass("ghost", "rounded-full px-5 py-2.5")}>{secondaryLabel}</Link>
      </div>
    </main>
  );
}
