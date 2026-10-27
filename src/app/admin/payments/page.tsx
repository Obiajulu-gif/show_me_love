import { requireAdminPage, searchPayments } from "@/lib/admin";

export default async function AdminPayments({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage();
  const q = (await searchParams).q ?? "";
  const rows = q ? await searchPayments(q) : [];
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-3xl italic">Find a payment</h1>
      <form className="flex gap-2">
        <input name="q" defaultValue={q} placeholder="Reference, username or supporter email" className="w-full max-w-md rounded-[18px] border border-line bg-white px-3 py-2" />
        <button className="rounded-full border border-line px-4 py-2 text-sm font-semibold">Search</button>
      </form>
      {q && rows.length === 0 && <p>No matches.</p>}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-cocoa-2"><tr><th className="p-2">Ref</th><th className="p-2">Creator</th><th className="p-2">Supporter</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Date</th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.ref} className="border-t border-line">
                  <td className="p-2 font-mono text-xs">{p.ref}</td>
                  <td className="p-2">{p.username ? `@${p.username}` : p.kind}</td>
                  <td className="p-2">{p.supporter_name}<br /><span className="text-cocoa-2">{p.supporter_email}</span></td>
                  <td className="p-2">{p.amount_ngn ? `NGN ${Number(p.amount_ngn).toLocaleString("en-NG")}` : ""}{p.received_usdt ? ` / ${Number(p.received_usdt).toFixed(2)} USDT` : ""}</td>
                  <td className="p-2">{p.status}</td>
                  <td className="p-2">{new Date(p.created_at).toLocaleString("en-GB")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
