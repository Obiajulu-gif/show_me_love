import type { PaymentRow } from "@/lib/stats";

const when = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function PaymentsTable({ rows }: { rows: PaymentRow[] }) {
  return (
    <div className="overflow-x-auto rounded-[18px] border border-line bg-white">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="border-b border-line text-cocoa-2">
          <tr><th className="p-3">From</th><th className="p-3">Message</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ref} className="border-b border-line last:border-0 align-top">
              <td className="p-3 font-semibold">{r.from}{r.viaGroup && <span className="ml-2 rounded-full bg-cream-2 px-2 py-0.5 text-xs font-normal">group</span>}</td>
              <td className="p-3 text-cocoa-2">{r.quantity > 1 ? `${r.quantity} treats. ` : ""}{r.message}</td>
              <td className="p-3 whitespace-nowrap">${r.amountUsdt}<div className="text-xs text-cocoa-2">₦{r.amountNgn.toLocaleString("en-NG")}</div></td>
              <td className="p-3 capitalize">{r.status}</td>
              <td className="p-3 whitespace-nowrap text-cocoa-2">{when(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
