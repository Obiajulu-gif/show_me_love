import Link from "next/link";
import { redirect } from "next/navigation";

import { ConnectDecision } from "@/components/ConnectDecision";
import { loadRequest } from "@/lib/connect";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 text-cocoa">
      <div className="w-full max-w-sm rounded-[18px] border border-line bg-cream-2 p-6">{children}</div>
    </main>
  );
}

export default async function Authorize({ searchParams }: { searchParams: Promise<{ req?: string | string[] }> }) {
  const { req } = await searchParams;
  const token = typeof req === "string" ? req : "";
  // Never redirect anywhere on a bad request: the redirect target is only trusted after the signature checks out.
  const loaded = await loadRequest(token).catch(() => null);
  if (!loaded) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl italic">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm text-cocoa-2">It may have expired. Go back to the app and start again.</p>
      </Shell>
    );
  }
  const uid = await currentUserId();
  if (!uid) redirect(`/login?next=${encodeURIComponent(`/connect/authorize?req=${encodeURIComponent(token)}`)}`);
  const creator = await getCreatorByUser(uid);
  if (!creator) {
    return (
      <Shell>
        <h1 className="font-serif text-2xl italic">Set up your page first</h1>
        <p className="mt-3 text-sm text-cocoa-2">You need a creator page before you can connect an app.</p>
        <Link href="/onboarding" className="mt-4 inline-block rounded-xl bg-honey px-4 py-2 font-semibold text-honey-ink shadow-[0_4px_0_#3B2416]">Set up my page</Link>
      </Shell>
    );
  }
  const { app } = loaded;
  return (
    <Shell>
      <h1 className="font-serif text-2xl italic">
        Connect <span className="not-italic font-bold">{app.name}</span>
        {app.mode === "sandbox" && <span className="ml-2 rounded-full border border-line bg-white px-2 py-0.5 align-middle font-sans text-xs font-semibold not-italic text-cocoa-2">Sandbox</span>}
      </h1>
      <p className="mt-3 text-sm text-cocoa-2">{app.name} is asking to connect to your show-me-love page, @{creator.username}. It will get:</p>
      <ConnectDecision req={token} />
    </Shell>
  );
}
