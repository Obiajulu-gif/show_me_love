import { AdminNav } from "@/components/AdminNav";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const [c] = await db()`select
    (select count(*) from withdrawals where status in ('awaiting_review','processing'))::int as withdrawals,
    (select count(*) from reports where resolved_at is null)::int as reports`;
  return (
    <div className="theme-paper min-h-screen bg-canvas text-fg md:flex">
      <AdminNav counts={{ withdrawals: c.withdrawals, reports: c.reports }} />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
