import Link from "next/link";

/** A coral heart with a mint coin tucked against it, ticked: love that has settled. */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="9.25" fill="#1D1712" stroke="#3B2F24" strokeWidth="1.5" />
      <path d="M13.5 24.2s-8-4.8-8-10.6a4.3 4.3 0 0 1 8-2.2 4.3 4.3 0 0 1 8 2.2c0 1-.2 2-.7 2.9" fill="#F0675A" />
      <circle cx="21.6" cy="21.4" r="6.2" fill="#33E0BE" stroke="#1D1712" strokeWidth="2" />
      <path d="m18.9 21.5 1.9 1.9 3.5-3.7" stroke="#062520" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="show-me-love home" className="group inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-lg font-display text-[1.15rem] font-bold tracking-[-0.03em] text-fg">
      <span className="transition-transform duration-200 ease-out group-hover:-rotate-6"><LogoMark /></span>
      show-me-love
    </Link>
  );
}
