import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-center text-fg">
      <Logo />
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">No page lives here yet.</h1>
      <p className="mt-2 text-muted">Claim this name before someone else does.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>Back to show-me-love</Link>
    </div>
  );
}
