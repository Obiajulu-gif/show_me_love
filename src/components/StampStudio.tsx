"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button, buttonClass } from "@/components/ui/Button";
import { clampOffset, coverScale, drawStamp, PHOTO_BOX, STAMP_H, STAMP_W } from "@/lib/stampCanvas";
import { xIntent, whatsappLink } from "@/lib/share";
import type { StampStyle } from "@/lib/stampStyles";

type Photo = ImageBitmap | HTMLImageElement;

function photoDims(p: Photo) {
  const w = "naturalWidth" in p && p.naturalWidth ? p.naturalWidth : p.width;
  const h = "naturalHeight" in p && p.naturalHeight ? p.naturalHeight : p.height;
  return { w, h };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("decode")); };
    img.src = url;
  });
}

const linkBtn = "inline-flex items-center justify-center rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-fg transition-colors hover:border-accent/60";

export function StampStudio({
  campaignId, style, headline, creatorName, username, treatName, link,
}: {
  campaignId: string; style: StampStyle; headline: string; creatorName: string; username: string; treatName: string; link: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ id: number; x: number; y: number; ox: number; oy: number } | null>(null);

  const [photo, setPhoto] = useState<Photo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);

  const shareMessage = `I support @${username} on show-me-love. Send a treat → ${link}`;

  const draw = useCallback(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!ctx) return;
    const dims = photo ? photoDims(photo) : null;
    const base = dims ? coverScale(dims.w, dims.h, PHOTO_BOX.w, PHOTO_BOX.h) : 1;
    drawStamp(ctx, {
      style, headline, creatorName, username, treatName,
      supporterName: name.trim(), supporterHandle: handle,
      photo,
      photoTransform: dims ? { scale: base * zoom, x: offset.x, y: offset.y } : undefined,
      qr: qrRef.current,
    });
  }, [style, headline, creatorName, username, treatName, name, handle, photo, zoom, offset]);

  useEffect(() => {
    const id = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(id);
  }, [draw]);

  async function loadPhoto(nextFile: File) {
    setError("");
    setNotice("");
    setFile(null);
    setCount(null);
    if (!/^image\/(png|jpeg|webp)$/.test(nextFile.type)) {
      setError("Use a PNG, JPEG or WebP photo.");
      return;
    }
    if (nextFile.size > 20 * 1024 * 1024) {
      setError("That photo is too large. Try one under 20 MB.");
      return;
    }
    try {
      let next: Photo;
      try {
        next = await createImageBitmap(nextFile, { imageOrientation: "from-image" });
      } catch {
        next = await loadImage(nextFile);
      }
      setPhoto(next);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    } catch {
      setError("That photo could not be opened. Try another one.");
    }
  }

  function changeZoom(next: number) {
    setZoom(next);
    if (!photo) return;
    const d = photoDims(photo);
    const base = coverScale(d.w, d.h, PHOTO_BOX.w, PHOTO_BOX.h);
    setOffset((o) => clampOffset(d.w, d.h, PHOTO_BOX.w, PHOTO_BOX.h, base * next, o.x, o.y));
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!photo) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId || !photo) return;
    const dims = photoDims(photo);
    const base = coverScale(dims.w, dims.h, PHOTO_BOX.w, PHOTO_BOX.h);
    const k = STAMP_W / e.currentTarget.getBoundingClientRect().width;
    setOffset(clampOffset(dims.w, dims.h, PHOTO_BOX.w, PHOTO_BOX.h, base * zoom,
      d.ox + (e.clientX - d.x) * k, d.oy + (e.clientY - d.y) * k));
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.id !== e.pointerId) return;
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  }

  async function download() {
    if (!photo) {
      setError("Add a photo first.");
      return;
    }
    setError("");
    setNotice("");
    setBusy(true);
    try {
      draw();
      const c = canvasRef.current;
      if (!c) return;
      const dataUrl = c.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `support-stamp-${username}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      const blob = await (await fetch(dataUrl)).blob();
      setFile(new File([blob], `support-stamp-${username}.png`, { type: "image/png" }));

      const r = await fetch("/api/stamps", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, name: name.trim(), handle }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) setCount(Number(j.count));
      else if (r.status === 429) setNotice(j.error ?? "Saved. This campaign is taking a short break from counting.");
    } catch {
      setError("The download did not finish. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice("Copy is not available here. Select the message and copy it by hand.");
    }
  }

  async function share() {
    if (!file) return;
    const data = { files: [file], text: shareMessage, title: `I support @${username}` };
    if (navigator.share && navigator.canShare?.(data)) {
      try {
        await navigator.share(data);
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    await copy(shareMessage);
  }

  return (
    <div className="space-y-6">
      <div className="sr-only" aria-hidden>
        <QRCodeCanvas ref={qrRef} value={link} size={256} marginSize={0} bgColor="#FFFFFF" fgColor="#2B160E" />
      </div>
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Support stamp</p>
        <h1 className="mt-1.5 font-display text-[clamp(1.9rem,4vw,2.8rem)] font-extrabold leading-[1] tracking-[-0.04em]">
          Put yourself on @{username}&apos;s stamp.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Add a photo, sign it, download it. The stamp carries @{username}&apos;s link and a QR code, so every share sends love back.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void loadPhoto(f); }}
            className={`rounded-[24px] border p-3 transition-colors ${dragging ? "border-accent bg-accent/5" : "border-line bg-canvas"}`}
          >
            <canvas
              ref={canvasRef}
              width={STAMP_W}
              height={STAMP_H}
              role="img"
              aria-label="Your support stamp preview"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className={`h-auto w-full rounded-[18px] shadow-paper ${photo ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
            />
          </div>
          <p className="text-center text-xs text-muted">
            {photo ? "Drag the photo to reposition it." : "Drop a photo here, or choose one below."}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className={buttonClass("ghost", "cursor-pointer")}>
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void loadPhoto(f); e.target.value = ""; }} />
              {photo ? "Change photo" : "Choose a photo"}
            </label>
            {photo && (
              <Button type="button" variant="ghost" onClick={() => { setPhoto(null); setFile(null); setCount(null); setZoom(1); setOffset({ x: 0, y: 0 }); }}>
                Remove
              </Button>
            )}
          </div>

          {photo && (
            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="stamp-zoom" className="text-xs font-semibold text-muted">Zoom</label>
                <button type="button" onClick={() => setOffset({ x: 0, y: 0 })} className="text-xs font-semibold text-accent hover:underline">Center</button>
              </div>
              <input id="stamp-zoom" type="range" min={1} max={3} step={0.01} value={zoom}
                onChange={(e) => changeZoom(Number(e.target.value))} className="w-full" />
              <div className="flex justify-between text-[11px] text-muted"><span>1×</span><span>3×</span></div>
            </div>
          )}

          {error && <p role="alert" className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</p>}
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-fg" htmlFor="stamp-name">
                Your name <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id="stamp-name" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} placeholder="Ada"
                className="mt-1.5 w-full rounded-xl border border-line bg-surface-2 px-3 py-2 text-fg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-fg" htmlFor="stamp-handle">
                Your handle <span className="font-normal text-muted">(optional)</span>
              </label>
              <div className="mt-1.5 flex items-center rounded-xl border border-line bg-surface-2">
                <span className="pl-3 text-muted">@</span>
                <input id="stamp-handle" value={handle} maxLength={24} placeholder="ada"
                  onChange={(e) => setHandle(e.target.value.replace(/^@+/, "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24))}
                  className="w-full rounded-xl bg-transparent px-1 py-2 text-fg outline-none" />
              </div>
            </div>
          </div>

          <Button type="button" onClick={() => void download()} disabled={!photo || busy} className="w-full">
            {busy ? "Making your stamp..." : photo ? "Download my stamp" : "Add a photo first"}
          </Button>

          {file && (
            <div className="space-y-3 rounded-2xl border border-line bg-surface-2 p-4">
              <div>
                <p className="font-semibold text-fg">{count !== null ? `Saved. You're stamp #${count}.` : "Saved."}</p>
                <p className="mt-0.5 text-sm text-muted">Now put it where people will see it.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" onClick={() => void share()}>Share stamp</Button>
                <a className={linkBtn} href={xIntent(shareMessage)} target="_blank" rel="noopener">Share on X</a>
                <a className={linkBtn} href={whatsappLink(shareMessage)} target="_blank" rel="noopener">WhatsApp</a>
                <button type="button" className={linkBtn} onClick={() => void copy(shareMessage)}>{copied ? "Copied" : "Copy message"}</button>
              </div>
              {notice && <p className="text-xs text-muted">{notice}</p>}
            </div>
          )}

          <p className="rounded-xl border border-dashed border-line bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
            Your photo stays on this device. We only save your name and handle if you add them.
          </p>

          <p className="text-xs leading-relaxed text-muted">
            This is a fan-made stamp for @{username}. The QR opens their page.
          </p>
        </div>
      </div>
    </div>
  );
}
