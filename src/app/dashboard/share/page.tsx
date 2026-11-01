import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CopyButton, MessageEditor, QrPanel } from "@/components/ShareTools";
import { RevokeAppButton } from "@/components/RevokeAppButton";
import { Card } from "@/components/ui/Card";
import { listCatalog } from "@/lib/catalog";
import { listConnectedApps } from "@/lib/connect";
import { getCreatorByUser } from "@/lib/creators";
import { toPageView, treatMap } from "@/lib/pageView";
import { creatorLink, embedHtml } from "@/lib/share";
import { currentUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "social", label: "Social & links" },
  { id: "website", label: "Website" },
  { id: "qr", label: "QR code" },
  { id: "apps", label: "Connected apps" },
] as const;
const ACCENT: Record<string, string> = { honey: "bg-accent text-on-accent", cocoa: "bg-surface-2 text-fg border border-line", sage: "bg-love text-on-love" };

export default async function Share({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const uid = await currentUserId();
  if (!uid) redirect("/login");
  const c = (await getCreatorByUser(uid))!;
  const { tab: t } = await searchParams;
  const tab = TABS.find((x) => x.id === t)?.id ?? "social";

  let origin = (process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (!origin) {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    origin = host ? `${h.get("x-forwarded-proto") ?? "http"}://${host}` : "";
  }
  const connected = tab === "apps" ? await listConnectedApps(uid) : [];
  const link = creatorLink(c.username, origin);
  const view = toPageView({
    username: c.username, displayName: c.displayName ?? c.username, bio: c.bio ?? "", photoUrl: c.photoUrl, treatId: c.treatId, customTreat: c.customTreat,
    unitPriceNgn: c.unitPriceNgn, presets: c.presets, thankYouText: c.thankYouText ?? "", accent: c.pageStyle.accent, socials: [],
  }, treatMap(await listCatalog()));
  const embed = embedHtml({ username: c.username, displayName: view.displayName, treatName: view.treatName, accent: c.pageStyle.accent }, origin);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Share</p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,3.2vw,2.6rem)] font-extrabold leading-[1] tracking-[-0.04em]">Put your link everywhere.</h1>
        <p className="mt-2 text-sm text-muted">One page, one link. Social bios, your website, a QR code for the table.</p>
      </div>
      <nav role="tablist" aria-label="Share options" className="inline-flex flex-wrap rounded-xl border border-line bg-surface-2 p-1">
        {TABS.map((x) => (
          <Link key={x.id} role="tab" aria-selected={tab === x.id} href={`/dashboard/share?tab=${x.id}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === x.id ? "bg-accent text-on-accent" : "text-muted hover:bg-surface"}`}>{x.label}</Link>
        ))}
      </nav>

      {tab === "social" && (
        <Card className="space-y-5">
          <div>
            <p className="text-sm font-semibold text-fg">Your page link</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-xl border border-line bg-surface-2 px-3 py-2 text-fg">{link}</code>
              <CopyButton text={link} label="Copy link" />
            </div>
          </div>
          <MessageEditor initial={c.shareMessage ?? ""} link={link} />
        </Card>
      )}

      {tab === "website" && (
        <Card className="space-y-4">
          <p className="text-sm text-muted">Paste this button into your site. It opens your page in a new tab.</p>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`inline-block rounded-xl px-4 py-2.5 font-semibold shadow-press ${ACCENT[c.pageStyle.accent ?? "honey"] ?? ACCENT.honey}`}>Send me a {view.treatName}</span>
            <span className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs font-semibold text-muted">Matches your page</span>
          </div>
          <pre className="whitespace-pre-wrap break-all rounded-xl border border-line bg-surface-2 p-3 text-xs text-fg">{embed}</pre>
          <CopyButton text={embed} label="Copy HTML embed" />
        </Card>
      )}

      {tab === "qr" && <Card><QrPanel link={link} username={c.username} treatName={view.treatName} /></Card>}

      {tab === "apps" && (
        <Card>
          {connected.length === 0 ? <p className="text-muted">No apps are connected yet.</p> : (
            <ul className="divide-y divide-line">
              {connected.map((a) => (
                <li key={a.appId} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-fg">{a.name}{a.mode === "sandbox" && <span className="ml-2 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted">Sandbox</span>}</p>
                    <p className="text-sm text-muted">Connected {a.connectedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  {a.earningsShared && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-on-accent">Earnings shared</span>}
                  <RevokeAppButton appId={a.appId} name={a.name} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
