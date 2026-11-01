"use client";

import { RotateCcw } from "lucide-react";

import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 py-16 text-center text-fg">
      <Logo />
      <p className="mt-10 font-mono text-xs uppercase tracking-[0.18em] text-love">Something went wrong</p>
      <h1 className="mt-3 max-w-lg font-display text-4xl font-extrabold leading-[0.98] tracking-[-0.045em] sm:text-5xl">That one did not land.</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">Nothing was charged. Try again, and if it keeps happening, come back in a minute.</p>
      <Button onClick={reset} className="mt-7 rounded-full px-5 py-2.5">
        <RotateCcw size={16} aria-hidden /> Try again
      </Button>
    </main>
  );
}
