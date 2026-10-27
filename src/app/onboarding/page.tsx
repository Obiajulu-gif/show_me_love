import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/OnboardingForm";
import { db } from "@/lib/db";
import { currentUserId } from "@/lib/session";

export default async function Page({ searchParams }: { searchParams: Promise<{ treat?: string; username?: string }> }) {
  const q = await searchParams;
  const uid = await currentUserId();
  if (!uid) redirect(`/signup?${new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])}`);
  const [have] = await db()`select 1 from creators where user_id = ${uid}`;
  if (have) redirect("/dashboard");
  return <OnboardingForm treat={q.treat || "zobo"} username={(q.username ?? "").toLowerCase()} />;
}
