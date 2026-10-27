import Link from "next/link";

import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export default async function AdminHome() {
  await requireAdminPage();
  const [r] = await db()`select count(*) filter (where status = 'awaiting_review')::int as review,
    count(*) filter (where status = 'processing' and admin_note = 'stuck alerted')::int as stuck from withdrawals`;
  return (
    <div className="space-y-3">
      <h1 className="font-serif text-3xl italic">Admin</h1>
      <p><Link className="underline" href="/admin/withdrawals">Withdrawal queue</Link>: {r.review} to review, {r.stuck} stuck in sending.</p>
      <p><Link className="underline" href="/admin/payments">Find a payment</Link></p>
    </div>
  );
}
