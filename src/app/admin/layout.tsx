import Link from "next/link";

import { requireAdminPage } from "@/lib/admin";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  return (
    <div className="min-h-screen bg-canvas px-4 py-6 text-fg md:px-8">
      <nav className="mb-6 flex gap-4 text-sm font-semibold">
        <Link href="/admin">Admin</Link>
        <Link href="/admin/withdrawals">Withdrawals</Link>
        <Link href="/admin/payments">Payments</Link>
        <Link href="/admin/reports">Reports</Link>
      </nav>
      {children}
    </div>
  );
}
