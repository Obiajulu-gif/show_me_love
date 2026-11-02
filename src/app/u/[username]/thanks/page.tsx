import { notFound } from "next/navigation";

import { ThanksStatus } from "@/components/ThanksStatus";
import { paymentStatus } from "@/lib/checkout";
import { practiceEnabled } from "@/lib/ras";

export const dynamic = "force-dynamic";

export default async function Thanks({ params, searchParams }: { params: Promise<{ username: string }>; searchParams: Promise<{ ref?: string }> }) {
  const { username } = await params;
  const { ref } = await searchParams;
  const s = ref && /^[A-Z0-9]{20}$/.test(ref) ? await paymentStatus(ref) : null;
  if (!ref || !s || s.creatorUsername?.toLowerCase() !== username.toLowerCase()) notFound();
  return (
    <main className="theme-paper mx-auto min-h-screen max-w-md bg-canvas px-4 py-12 text-fg">
      <ThanksStatus ref_={ref} username={s.creatorUsername!} initial={s.status} amountNgn={s.amountNgn} canSimulate={practiceEnabled()} />
    </main>
  );
}
