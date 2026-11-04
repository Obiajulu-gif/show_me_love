import type { PaymentRow } from "@/lib/stats";

const when = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-[18px] border border-line bg-surface-2 sm:block">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr><th className="p-3">From</th><th className="p-3">Message</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ref} className="border-b border-line last:border-0 align-top">
                <td className="p-3 font-semibold">{r.from}{r.viaGroup && <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-xs font-normal">group</span>}</td>
                <td className="p-3 text-muted">{r.quantity > 1 ? `${r.quantity} treats. ` : ""}{r.message}</td>
                <td className="data p-3 whitespace-nowrap text-green">${r.amountUsdt}<div className="text-xs text-muted">₦{r.amountNgn.toLocaleString("en-NG")}</div></td>
                <td className="p-3 capitalize">{r.status}</td>
                <td className="p-3 whitespace-nowrap text-muted">{when(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-2 sm:hidden">
        {rows.map((r) => (
          <li key={r.ref} className="rounded-[16px] border border-line bg-surface-2 p-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  <span className="truncate">{r.from}</span>
                  {r.viaGroup && <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-normal text-muted">group</span>}
                </p>
                <p className="mt-1 text-xs capitalize text-muted">{when(r.createdAt)} · {r.status}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="data text-sm text-green">${r.amountUsdt}</p>
                <p className="text-xs text-muted">₦{r.amountNgn.toLocaleString("en-NG")}</p>
              </div>
            </div>
            <p className="mt-2 break-words text-sm text-muted">{r.quantity > 1 ? `${r.quantity} treats. ` : ""}{r.message}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
