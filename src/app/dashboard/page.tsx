import Link from "next/link";
import { redirect } from "next/navigation";

import { PaymentsTable } from "@/components/PaymentsTable";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCreatorByUser } from "@/lib/creators";
import { currentUserId } from "@/lib/session";
import { overview } from "@/lib/stats";

export default async function Overview() {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const c = await getCreatorByUser(uid);
  if (!c) redirect("/onboarding");
  const o = await overview(uid);
  const money = (usdt: string) => {
    const base = `$${Number(usdt).toFixed(2)}`;
    return o.ngnPerUsd ? `${base} · ≈ ₦${Math.round(Number(usdt) * o.ngnPerUsd).toLocaleString("en-NG")}` : base;
  };
  const steps = [
    { done: o.setup.page, label: "Create your page" },
    { done: o.setup.photoBio, label: "Add a photo and a short bio" },
    { done: o.setup.birthday, label: "Share your birthday (optional)" },
  ];
  const stats = [
    { label: "Received so far", value: money(o.totalReceivedUsdt), tint: true },
    { label: "Available balance", value: money(o.balanceUsdt) },
    { label: "Treats received", value: String(o.treatCount) },
  ];
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl italic">Hi {c.displayName || c.username}, here&apos;s how your page is doing.</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/share" className={buttonClass("primary")}>Share my page</Link>
          <Link href="/dashboard/your-page" className={buttonClass("ghost")}>Edit page</Link>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className={s.tint ? "!bg-honey/40" : ""}>
            <p className="text-sm text-cocoa-2">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">Page setup: {steps.filter((s) => s.done).length} of 3 complete</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {steps.map((s) => <li key={s.label}>{s.done ? "✓" : "○"} {s.label}</li>)}
        </ul>
      </Card>
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Latest treats</h2>
          <Link href="/dashboard/treats" className="text-sm underline">See all</Link>
        </div>
        {o.recent.length ? <PaymentsTable rows={o.recent} /> : (
          <Card className="text-center text-cocoa-2">No treats yet. Share your page and your first one will show up here.</Card>
        )}
      </section>
    </div>
  );
}
