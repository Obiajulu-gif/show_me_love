"use client";

import { useRouter } from "next/navigation";

export function ResolveReportButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button className="rounded-full border border-line px-3 py-1 text-xs font-semibold" onClick={async () => {
      await fetch(`/api/admin/reports/${id}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      router.refresh();
    }}>Resolve</button>
  );
}
