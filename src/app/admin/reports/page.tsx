import Link from "next/link";

import { PageHead } from "@/components/AdminUi";
import { ResolveReportButton } from "@/components/ResolveReportButton";
import { listOpenReports, requireAdminPage } from "@/lib/admin";

export default async function AdminReports() {
  await requireAdminPage();
  const rows = await listOpenReports();
  return (
    <div className="space-y-4">
      <PageHead title="Reports" sub="Pages people flagged. Review the page, then mark the report resolved." />
      {rows.length === 0 ? <p className="text-muted">No open reports.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted"><tr><th className="p-2">Page</th><th className="p-2">Reason</th><th className="p-2">Details</th><th className="p-2">Date</th><th className="p-2" /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line align-top">
                  <td className="p-2"><Link className="underline" href={`/@${r.username}`}>@{r.username}</Link></td>
                  <td className="p-2">{r.reason}</td>
                  <td className="whitespace-pre-wrap p-2">{r.details}{r.reporter_email ? <><br /><span className="text-muted">{r.reporter_email}</span></> : null}</td>
                  <td className="p-2">{new Date(r.created_at).toLocaleString("en-GB")}</td>
                  <td className="p-2"><ResolveReportButton id={r.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
