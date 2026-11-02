import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const creator = await getCreatorByUser(uid);
  if (!creator) redirect("/onboarding");
  return (
    <div className="theme-ledger min-h-screen bg-canvas text-fg md:flex">
      <Sidebar username={creator.username} displayName={creator.displayName ?? creator.username} photoUrl={creator.photoUrl} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
