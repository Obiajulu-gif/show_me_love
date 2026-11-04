"use client";

import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { StampPreview } from "@/components/StampPreview";
import { CopyButton } from "@/components/ShareTools";
import { Button, buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { STAMP_PALETTES } from "@/lib/stampCanvas";
import { STAMP_STYLES, type StampStyle } from "@/lib/stampStyles";
import type { StampCampaign, StampStats } from "@/lib/stamps";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function StampManager({
  campaign, link, stats, defaultStyle, displayName, username, treatName,
}: {
  campaign: StampCampaign | null;
  link: string;
  stats: StampStats;
  defaultStyle: StampStyle;
  displayName: string;
  username: string;
  treatName: string;
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(campaign?.headline ?? "I support");
  const [style, setStyle] = useState<StampStyle>(campaign?.style ?? defaultStyle);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const qr = useRef<HTMLCanvasElement>(null);
  const live = campaign?.active ?? false;

  async function post(payload: { headline?: string; style?: StampStyle; active?: boolean }, ok: string) {
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/stamps/campaign", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus(j.error ?? "Could not save.");
        return;
      }
      setStatus(ok);
      router.refresh();
    } catch {
      setStatus("Could not save. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  function downloadQr() {
    const c = qr.current;
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${username}-stamp-qr.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${live ? "bg-love/15 text-love" : "bg-surface-2 text-muted"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-love" : "bg-muted"}`} />
                {live ? "Live" : campaign ? "Paused" : "Not published"}
              </span>
              <span className="text-xs text-muted">{stats.total} stamp{stats.total === 1 ? "" : "s"} made</span>
            </div>
            <h2 className="mt-2 font-display text-xl font-bold tracking-tight">Design your stamp</h2>
            <p className="mt-1 text-sm text-muted">Supporters add their photo, download it, and share it with your link.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {live ? (
              <Button type="button" variant="ghost" onClick={() => void post({ active: false }, "Paused. Your studio link is hidden.")} disabled={busy}>Pause</Button>
            ) : (
              <Button type="button" onClick={() => void post({ headline, style, active: true }, "Your stamp is live.")} disabled={busy}>
                {campaign ? "Go live" : "Publish"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <div className="mx-auto w-full max-w-[360px] md:mx-0">
            <StampPreview style={style} headline={headline} creatorName={displayName} username={username} treatName={treatName} link={link} />
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-fg" htmlFor="stamp-headline">Headline</label>
              <input id="stamp-headline" value={headline} maxLength={40} onChange={(e) => { setHeadline(e.target.value); setStatus(""); }}
                className="mt-2 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-fg" />
              <p className="mt-1 text-xs text-muted">{headline.length}/40</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-fg">Style</p>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {STAMP_STYLES.map((s) => {
                  const p = STAMP_PALETTES[s];
                  return (
                    <button key={s} type="button" aria-pressed={style === s} onClick={() => { setStyle(s); setStatus(""); }}
                      className={`rounded-xl border p-2 text-left transition-transform duration-150 ease-out active:scale-[0.98] ${style === s ? "border-accent bg-accent/5" : "border-line bg-surface-2 hover:bg-surface"}`}>
                      <span className="block h-10 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.panel[0]}, ${p.panel[1]}, ${p.panel[2]})` }} />
                      <span className="mt-1.5 block text-xs font-semibold capitalize text-fg">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            {campaign && (
              <Button type="button" variant="ghost" onClick={() => void post({ headline, style }, "Saved.")} disabled={busy}>
                {busy ? "Saving..." : "Save changes"}
              </Button>
            )}
            {!campaign && <p className="text-sm text-muted">Publish to create your studio link.</p>}
            {status && <p role="status" className="text-sm text-muted">{status}</p>}
          </div>
        </div>
      </Card>

      <div className="space-y-5">
        <Card className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-fg">Your studio link</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="break-all rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-fg">{link}</code>
              <CopyButton text={link} label="Copy link" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-[132px] rounded-xl bg-white p-2 [&_canvas]:!h-auto [&_canvas]:!w-full">
              <QRCodeCanvas ref={qr} value={link} size={360} marginSize={1} />
            </div>
            <div className="space-y-2">
              <Button type="button" variant="ghost" onClick={downloadQr}>Download QR</Button>
              {live ? (
                <Link href={`/@${username}/stamp`} target="_blank" className={buttonClass("ghost", "block")}>Open studio</Link>
              ) : (
                <p className="max-w-[180px] text-xs text-muted">Publish to activate the link.</p>
              )}
            </div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-canvas p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">Total</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-fg">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-line bg-canvas p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">Last 7 days</p>
              <p className="mt-1 font-display text-2xl font-extrabold text-fg">{stats.week}</p>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Recent stamps</p>
            {stats.recent.length ? (
              <ul className="mt-2 divide-y divide-line">
                {stats.recent.map((r, i) => (
                  <li key={`${i}-${r.name ?? "anon"}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-fg">
                      {r.name || "Anonymous"}
                      {r.handle && <span className="ml-1 font-normal text-muted">@{r.handle}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{DAY.format(new Date(r.at))}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">No stamps yet. Share your studio link.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
