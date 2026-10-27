import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-5 text-center text-cocoa">
      <Logo />
      <h1 className="mt-8 font-serif text-3xl italic">No page lives here yet.</h1>
      <p className="mt-2 text-cocoa-2">Claim this name before someone else does.</p>
      <Link href="/" className={buttonClass("primary", "mt-6")}>Back to show-me-love</Link>
    </div>
  );
}
