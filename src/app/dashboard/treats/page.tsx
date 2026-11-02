import { redirect } from "next/navigation";

import { PaymentsTable } from "@/components/PaymentsTable";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { currentUserId } from "@/lib/session";
import { FILTERS, listPayments, PAGE_SIZE, type PaymentFilter } from "@/lib/stats";
import Link from "next/link";

const EMPTY: Record<PaymentFilter, string> = {
  successful: "No treats yet. Share your page and they will land here.",
  pending: "Nothing waiting on payment right now.",
  expired: "No expired payments.",
  failed: "No failed payments.",
  refunded: "No refunds.",
  all: "Nothing here yet.",
};

export default async function Treats({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as PaymentFilter) : "successful";
  const page = Math.min(100000, Math.max(1, parseInt(sp.page ?? "1", 10) || 1));
  const { rows, count } = await listPayments(uid, filter, page);
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const href = (p: number) => `/dashboard/treats?status=${filter}&page=${p}`;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Treats</p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">Your treats</h1>
        <p className="mt-2 text-sm text-muted">Every payment, what arrived, and the note that came with it.</p>
      </div>
      <form className="flex flex-wrap items-center gap-3" action="/dashboard/treats">
        <select name="status" defaultValue={filter} aria-label="Status" className="rounded-xl border border-line bg-surface-2 px-3 py-2">
          {FILTERS.map((f) => <option key={f} value={f}>{f[0].toUpperCase() + f.slice(1)}</option>)}
        </select>
        <button className={buttonClass("ghost")}>Apply</button>
        <span className="text-sm text-muted">{count} {count === 1 ? "payment" : "payments"}</span>
      </form>
      {rows.length ? <PaymentsTable rows={rows} /> : <Card className="text-center text-muted">{EMPTY[filter]}</Card>}
      {pages > 1 && (
        <div className="flex items-center gap-4 text-sm">
          {page > 1 && <Link href={href(page - 1)} className="underline">Previous</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={href(page + 1)} className="underline">Next</Link>}
        </div>
      )}
    </div>
  );
}
