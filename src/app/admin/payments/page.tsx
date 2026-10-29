import Link from "next/link";

import { ago, PageHead, STATUS_TONE } from "@/components/AdminUi";
import { RefundForm } from "@/components/RefundForm";
import { buttonClass } from "@/components/ui/Button";
import { requireAdminPage, searchPayments } from "@/lib/admin";
import { PAYMENT_STATUSES, recentPayments } from "@/lib/adminInsights";

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = (PAYMENT_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const rows = q ? await searchPayments(q) : await recentPayments({ status, limit: 100 });
  const chip = (s: string | undefined, label: string) => (
    <Link key={label} href={s ? `/admin/payments?status=${s}` : "/admin/payments"} aria-current={status === s && !q ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-sm capitalize transition-colors duration-150 ${status === s && !q ? "border-accent bg-accent text-on-accent" : "border-line text-muted hover:text-fg"}`}>{label}</Link>
  );

  return (
    <div className="space-y-6">
      <PageHead title="Payments" sub={q ? `Results for "${q}"` : "The latest 100 payments. Search by reference, username or supporter email."}>
        <form className="flex w-full gap-2 sm:w-auto" role="search">
          <label htmlFor="pay-q" className="sr-only">Search payments</label>
          <input id="pay-q" name="q" defaultValue={q} placeholder="Reference, username or email" className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm sm:w-72" />
          <button className={buttonClass("ghost", "py-2 text-sm")}>Search</button>
        </form>
      </PageHead>
      <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
        {chip(undefined, "All")}
        {PAYMENT_STATUSES.map((s) => chip(s, s))}
      </nav>

      {rows.length === 0 ? <p className="text-muted">{q ? "No payment matches that." : "No payments here yet."}</p> : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="bg-surface/60 text-xs text-muted">
              <tr><th className="px-4 py-3 font-semibold">Supporter</th><th className="px-4 py-3 font-semibold">To</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">When</th><th className="px-4 py-3 font-semibold">Ref</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.ref} className="align-top hover:bg-surface/40">
                  <td className="px-4 py-3"><span className="block font-semibold">{p.supporter_name || "Someone"}</span><span className="block text-xs text-muted">{p.supporter_email}</span></td>
                  <td className="px-4 py-3">{p.username ? <Link href={`/admin/users?q=${p.username}`} className="underline">@{p.username}</Link> : <span className="capitalize text-muted">{p.kind}</span>}</td>
                  <td className="data whitespace-nowrap px-4 py-3 text-right">{p.amount_ngn ? `₦${Number(p.amount_ngn).toLocaleString("en-NG")}` : ""}<span className="block text-xs text-muted">{p.received_usdt ? `${Number(p.received_usdt).toFixed(2)} USDT in` : p.amount_usdt ? `${Number(p.amount_usdt).toFixed(2)} USDT quoted` : ""}</span></td>
                  <td className={`px-4 py-3 font-semibold capitalize ${STATUS_TONE[p.status] ?? ""}`}>{p.status}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted" title={new Date(p.created_at).toLocaleString("en-GB")}>{ago(new Date(p.created_at))}</td>
                  <td className="data px-4 py-3 text-xs text-muted">{p.ref}</td>
                  <td className="px-4 py-3">{p.status === "successful" && p.kind !== "group" ? <RefundForm pref={p.ref} /> : p.status === "refunded" && p.refund_address ? <span className="break-all text-xs text-muted">Refunded to {p.refund_address}</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
