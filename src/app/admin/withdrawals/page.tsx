import { PageHead } from "@/components/AdminUi";
import { AdminActions } from "@/components/AdminActions";
import { listQueue, requireAdminPage } from "@/lib/admin";

const dest = (d: Record<string, string>) =>
  d.kind === "bank" ? `${d.bankName} ${d.accountNumber} (${d.accountName})` : `${String(d.network).toUpperCase()} ${d.address}`;

export default async function AdminWithdrawals() {
  await requireAdminPage();
  const rows = await listQueue();
  return (
    <div className="space-y-4">
      <PageHead title="Withdrawals" sub="Requests waiting for review, and USDT sends that got stuck." />
      {rows.length === 0 ? <p className="text-muted">Nothing waiting. New requests show up here.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="p-2">Creator</th><th className="p-2">Amount</th><th className="p-2">Pay to</th><th className="p-2">State</th><th className="p-2">Action</th></tr></thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t border-line align-top">
                  <td className="p-2">@{w.username}<br /><span className="text-muted">{w.email}</span></td>
                  <td className="p-2">{Number(w.amount_usdt).toFixed(2)} USDT (fee {Number(w.fee_usdt).toFixed(2)}){w.amount_ngn ? <><br />about NGN {Number(w.amount_ngn).toLocaleString("en-NG")}</> : null}</td>
                  <td className="break-all p-2">{dest(w.destination)}</td>
                  <td className="p-2">{w.status === "processing" ? "Stuck in sending: check Roqqu before acting" : "In review"}<br /><span className="text-muted">{new Date(w.created_at).toLocaleString("en-GB")}</span></td>
                  <td className="p-2"><AdminActions w={w} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
