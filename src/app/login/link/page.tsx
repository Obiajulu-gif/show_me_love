import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";

export const dynamic = "force-dynamic";

/** Landing page for the emailed sign-in link: one press spends the code (scanners never press it). */
export default async function MagicLink({ searchParams }: { searchParams: Promise<{ code?: string; next?: string }> }) {
  const { code = "", next = "" } = await searchParams;
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-canvas px-5 text-fg">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight">Sign in to show-me-love</h1>
        <p className="mt-2 text-muted">This link works once and expires 15 minutes after it was sent.</p>
        <form method="post" action="/api/auth/magic/verify" className="mt-8">
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="next" value={next} />
          <button className={buttonClass("primary", "w-full py-2.5 text-base")}>Sign in</button>
        </form>
      </div>
    </main>
  );
}
