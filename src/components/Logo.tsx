import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path d="M5 11h18v7a8 8 0 0 1-8 8h-2a8 8 0 0 1-8-8v-7Z" fill="#F6C55A" stroke="#3B2416" strokeWidth="2" strokeLinejoin="round" />
      <path d="M23 13h2.5a3 3 0 0 1 0 6H22.5" stroke="#3B2416" strokeWidth="2" strokeLinecap="round" />
      <path d="M14 21.5s-4-2.4-4-5.2a2.2 2.2 0 0 1 4-1.2 2.2 2.2 0 0 1 4 1.2c0 2.8-4 5.2-4 5.2Z" fill="#7A4A2E" />
      <path d="M11 4.5c-1 1 1 2 0 3.5M16 3.5c-1 1 1 2 0 3.5" stroke="#7A4A2E" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-serif text-xl italic text-cocoa">
      <LogoMark />
      show-me-love
    </Link>
  );
}
