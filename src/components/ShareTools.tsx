"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { shareText, whatsappLink, xIntent } from "@/lib/share";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("fail");
    }
    setTimeout(() => setState("idle"), 2500);
  }
  return (
    <span className="inline-flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={copy}>{state === "done" ? "Copied" : label}</Button>
      {state === "fail" && <span role="status" className="text-sm text-muted">Copy is not available here. Select the text and copy it by hand.</span>}
    </span>
  );
}

const linkBtn = "rounded-xl border border-line bg-surface-2 px-4 py-2 font-semibold text-fg hover:bg-surface";

export function MessageEditor({ initial, link }: { initial: string; link: string }) {
  const [msg, setMsg] = useState(initial);
  const [status, setStatus] = useState("");
  async function save() {
    setStatus("Saving...");
    const r = await fetch("/api/creator", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ share_message: msg }) });
    const j = await r.json().catch(() => ({}));
    setStatus(r.ok ? "Saved" : j.error ?? "Could not save.");
  }
  const text = shareText(msg, link);
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold text-fg" htmlFor="share-msg">Message that goes with your link</label>
      <textarea id="share-msg" value={msg} maxLength={280} rows={3} onChange={(e) => { setMsg(e.target.value); setStatus(""); }}
        className="w-full rounded-xl border border-line bg-surface-2 p-3 text-fg" />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={save}>Save message</Button>
        <CopyButton text={text} label="Copy message and link" />
        <a className={linkBtn} href={xIntent(text)} target="_blank" rel="noopener">Share on X</a>
        <a className={linkBtn} href={whatsappLink(text)} target="_blank" rel="noopener">Send on WhatsApp</a>
        <span role="status" className="text-sm text-muted">{status}</span>
      </div>
    </div>
  );
}

function save(canvas: HTMLCanvasElement, name: string) {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = name;
  a.click();
}

export function QrPanel({ link, username, treatName }: { link: string; username: string; treatName: string }) {
  const [mode, setMode] = useState<"card" | "compact">("card");
  const qr = useRef<HTMLCanvasElement>(null);
  const heading = `Send me a ${treatName}`;

  function download() {
    const q = qr.current;
    if (!q) return;
    if (mode === "compact") return save(q, `${username}-qr.png`);
    const W = 600, H = 760, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#FFF9EE"; g.fillRect(0, 0, W, H);
    g.textAlign = "center"; g.fillStyle = "#3B2416";
    g.font = "600 22px system-ui, sans-serif"; g.fillText("show-me-love", W / 2, 60);
    g.font = "700 38px system-ui, sans-serif"; g.fillText(heading, W / 2, 125, W - 60);
    g.fillStyle = "#fff"; g.fillRect(100, 160, 400, 400);
    g.drawImage(q, 120, 180, 360, 360);
    g.fillStyle = "#3B2416"; g.font = "600 30px system-ui, sans-serif"; g.fillText(`@${username}`, W / 2, 625);
    g.fillStyle = "#F6C55A"; g.beginPath(); g.roundRect(170, 660, 260, 56, 28); g.fill();
    g.fillStyle = "#2B1A0E"; g.font = "700 22px system-ui, sans-serif"; g.fillText("Scan to send love", W / 2, 696);
    save(c, `${username}-card.png`);
  }

  const qrEl = <QRCodeCanvas ref={qr} value={link} size={360} marginSize={1} />;
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1" role="group" aria-label="QR style">
        {(["card", "compact"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === m ? "bg-accent text-on-accent" : "text-muted hover:bg-surface"}`}>
            {m === "card" ? "Branded card" : "Compact QR"}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">Tip: in OBS, add the downloaded PNG as an image source to show it on stream.</p>
      {mode === "card" ? (
        <div className="mx-auto w-full max-w-xs rounded-[18px] border border-line bg-canvas p-6 text-center">
          <p className="font-semibold text-muted">show-me-love</p>
          <p className="mt-1 text-2xl font-bold text-fg">{heading}</p>
          <div className="mx-auto mt-4 w-fit rounded-xl bg-surface-2 p-3 [&_canvas]:!h-auto [&_canvas]:!w-full">{qrEl}</div>
          <p className="mt-3 text-lg font-semibold text-fg">@{username}</p>
          <span className="mt-2 inline-block rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-on-accent">Scan to send love</span>
        </div>
      ) : (
        <div className="mx-auto w-fit rounded-xl bg-surface-2 p-3 [&_canvas]:!h-auto [&_canvas]:!w-60">{qrEl}</div>
      )}
      <Button type="button" onClick={download}>Download PNG</Button>
    </div>
  );
}
