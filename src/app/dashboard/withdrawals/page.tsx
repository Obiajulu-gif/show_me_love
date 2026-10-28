import { redirect } from "next/navigation";

import { WithdrawPanel } from "@/components/WithdrawPanel";
import { Card } from "@/components/ui/Card";
import { balance } from "@/lib/ledger";
import { currentUserId } from "@/lib/session";
import { getDestinations, listWithdrawals } from "@/lib/withdrawals";

const CHIP: Record<string, [string, string]> = {
  awaiting_review: ["In review", "bg-warn/15 text-warn"],
  processing: ["Sending", "bg-blue-100"],
  paid: ["Paid", "bg-green-100"],
  rejected: ["Rejected", "bg-red-100"],
  failed: ["Failed", "bg-red-100"],
};
const dest = (d: Record<string, string>) => (d.kind === "bank" ? `${d.bankName} ••${d.accountNumber?.slice(-4)}` : `${String(d.network).toUpperCase()} ${d.address?.slice(0, 6)}…${d.address?.slice(-4)}`);

export default async function Withdrawals() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const [bal, dests, rows] = await Promise.all([balance(uid), getDestinations(uid), listWithdrawals(uid)]);
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Withdrawals</h1>
      <WithdrawPanel available={bal} usdt={dests.usdt} bank={dests.bank} />
      <Card className="overflow-x-auto p-0">
        {rows.length ? (
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="p-3">To</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3">Date</th></tr></thead>
            <tbody>
              {rows.map((w) => {
                const [label, bg] = CHIP[w.status] ?? [w.status, ""];
                return (
                  <tr key={w.id} className="border-t border-line">
                    <td className="p-3">{dest(w.destination as Record<string, string>)}</td>
                    <td className="p-3">{Number(w.amount_usdt).toFixed(2)} USDT <span className="text-muted">(fee {Number(w.fee_usdt).toFixed(2)})</span></td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${bg}`}>{label}</span></td>
                    <td className="p-3">{new Date(w.created_at).toLocaleDateString("en-GB")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : <p className="p-6 text-center text-muted">No withdrawals yet.</p>}
      </Card>
      <p className="text-sm text-muted">New accounts are reviewed during their first day, so early withdrawals can take a little longer.</p>
    </div>
  );
}
