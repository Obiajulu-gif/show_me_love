"use client";

import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useRef } from "react";

import { drawStamp, STAMP_H, STAMP_W } from "@/lib/stampCanvas";
import type { StampStyle } from "@/lib/stampStyles";

export function StampPreview({
  style, headline, creatorName, username, treatName, link,
}: {
  style: StampStyle; headline: string; creatorName: string; username: string; treatName: string; link: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const qr = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (!ctx) return;
      drawStamp(ctx, { style, headline, creatorName, username, treatName, qr: qr.current });
    });
    return () => cancelAnimationFrame(id);
  }, [style, headline, creatorName, username, treatName, link]);

  return (
    <div className="relative">
      <canvas ref={canvas} width={STAMP_W} height={STAMP_H} role="img" aria-label={`Stamp preview for @${username}`}
        className="h-auto w-full rounded-[18px] shadow-paper" />
      <div className="sr-only" aria-hidden>
        <QRCodeCanvas ref={qr} value={link} size={256} marginSize={0} bgColor="#FFFFFF" fgColor="#2B160E" />
      </div>
    </div>
  );
}
