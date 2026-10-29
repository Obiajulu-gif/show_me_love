import Link from "next/link";

import { ago, PageHead, usd } from "@/components/AdminUi";
import { buttonClass } from "@/components/ui/Button";
import { requireAdminPage } from "@/lib/admin";
import { listUsers } from "@/lib/adminInsights";

const PER = 50;

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const q = (sp.q ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const { rows, total } = await listUsers({ q, limit: PER, offset: (page - 1) * PER });
  const pages = Math.max(1, Math.ceil(total / PER));
  const href = (p: number) => `/admin/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <div className="space-y-6">
      <PageHead title="Users" sub={`${total} ${q ? "matching" : "registered"}${q ? ` "${q}"` : ""}, newest first.`}>
        <form className="flex w-full gap-2 sm:w-auto" role="search">
          <label htmlFor="user-q" className="sr-only">Search users</label>
          <input id="user-q" name="q" defaultValue={q} placeholder="Email or username" className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm sm:w-64" />
          <button className={buttonClass("ghost", "py-2 text-sm")}>Search</button>
        </form>
      </PageHead>

      {rows.length === 0 ? <p className="text-muted">{q ? "No one matches that. Try part of an email or username." : "No one has signed up yet."}</p> : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-surface/60 text-xs text-muted">
              <tr><th className="px-4 py-3 font-semibold">User</th><th className="px-4 py-3 font-semibold">Page</th><th className="px-4 py-3 text-right font-semibold">Treats</th><th className="px-4 py-3 text-right font-semibold">Received</th><th className="px-4 py-3 text-right font-semibold">Balance</th><th className="px-4 py-3 font-semibold">Last treat</th><th className="px-4 py-3 font-semibold">Joined</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((u) => (
                <tr key={u.id} className="align-top hover:bg-surface/40">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{u.displayName || u.email}</span>
                    <span className="block text-xs text-muted">{u.email}{u.role === "admin" && <span className="ml-2 rounded-full bg-accent/15 px-1.5 text-accent">admin</span>}</span>
                  </td>
                  <td className="px-4 py-3">{u.username ? <Link href={`/@${u.username}`} target="_blank" className="underline">@{u.username}</Link> : <span className="text-muted">Not set up</span>}</td>
                  <td className="data px-4 py-3 text-right">{u.treats}</td>
                  <td className="data whitespace-nowrap px-4 py-3 text-right">{usd(u.receivedUsdt)}</td>
                  <td className="data whitespace-nowrap px-4 py-3 text-right">{usd(u.balanceUsdt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted">{u.lastTreat ? ago(u.lastTreat) : "None yet"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted" title={u.joined.toLocaleString("en-GB")}>{ago(u.joined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline">Newer</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="underline">Older</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
