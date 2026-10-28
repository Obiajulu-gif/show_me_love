import Link from "next/link";

/** A heart-shaped cup: coral heart, teal rim — affection that settles as money. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#171E45" stroke="#2E3778" />
      <path d="M8 12h14v5.5a6.5 6.5 0 0 1-6.5 6.5h-1A6.5 6.5 0 0 1 8 17.5V12Z" stroke="#33E0BE" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M22 13.5h1.6a2.4 2.4 0 0 1 0 4.8H22" stroke="#33E0BE" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M15 21s-3.6-2.1-3.6-4.6a1.9 1.9 0 0 1 3.6-1 1.9 1.9 0 0 1 3.6 1C18.6 18.9 15 21 15 21Z" fill="#FF8197" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-fg">
      <LogoMark />
      show-me-love
    </Link>
  );
}
