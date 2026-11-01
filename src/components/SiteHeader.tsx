"use client";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "./Logo";
import { buttonClass } from "./ui/Button";

const LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/@hello", label: "Example page" },
  { href: "/#faq", label: "Questions" },
];

/** Public site header: sticky, one nav, one menu button under 768px. */
export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);
  useEffect(() => setOpen(false), [path]);

  const link = (href: string) => `rounded-full px-3 py-2 text-[13.5px] font-semibold transition-colors duration-150 ${path === href ? "text-fg" : "text-muted hover:text-fg"}`;

  return (
    <header className={`sticky top-0 z-30 border-b transition-colors duration-200 ${scrolled || open ? "border-line/80 bg-canvas/85 backdrop-blur-md" : "border-line/60 bg-canvas/60"}`}>
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-3.5">
        <Logo />
        <nav aria-label="Main" className="hidden items-center md:flex">
          {LINKS.map((l) => <Link key={l.href} href={l.href} className={link(l.href)} aria-current={path === l.href ? "page" : undefined}>{l.label}</Link>)}
        </nav>
        <div className="flex items-center justify-self-end gap-2 text-sm">
          <Link href="/login" className="hidden rounded-full px-3 py-2 font-semibold text-muted transition-colors hover:text-fg sm:inline-flex">Log in</Link>
          <Link href="/signup" className={buttonClass("primary", "hidden whitespace-nowrap rounded-full px-4 py-1.5 sm:inline-flex")}>Start my page</Link>
          <button type="button" aria-expanded={open} aria-controls="site-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}
            className="-mr-2 rounded-lg p-2 text-muted hover:text-fg md:hidden">
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="site-menu" aria-label="Main" className="border-t border-line/70 px-5 pb-5 pt-2 md:hidden motion-safe:animate-fade-in">
          <ul className="flex flex-col">
            {LINKS.map((l) => <li key={l.href}><Link href={l.href} onClick={() => setOpen(false)} className="block border-b border-line/60 py-3 text-base font-semibold">{l.label}</Link></li>)}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/login" className={buttonClass("ghost", "rounded-full")}>Log in</Link>
            <Link href="/signup" className={buttonClass("primary", "rounded-full")}>Start my page</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
