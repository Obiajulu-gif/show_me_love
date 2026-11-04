import type { StampStyle } from "./stampStyles";

export const STAMP_W = 1080;
export const STAMP_H = 1350;

export const PHOTO_BOX = { x: 190, y: 190, w: 700, h: 700 };
export const PHOTO_RADIUS = 24;

export type StampPalette = {
  paper: string;
  panel: [string, string, string];
  ink: string;
  soft: string;
};

export const STAMP_PALETTES: Record<StampStyle, StampPalette> = {
  honey: { paper: "#FFF9EE", panel: ["#F4B36A", "#E96B5C", "#8E3B51"], ink: "#2B160E", soft: "rgba(43,22,14,.68)" },
  cocoa: { paper: "#F3E9DC", panel: ["#2A221B", "#171310", "#0B0907"], ink: "#F5EEE4", soft: "rgba(245,238,228,.70)" },
  sage: { paper: "#F3FFF9", panel: ["#9FE3D3", "#17B394", "#0E7C66"], ink: "#06251F", soft: "rgba(6,37,31,.68)" },
};

export const CARD_INK = "#2B160E";
export const CARD_SOFT = "#6B5545";

export type PhotoTransform = { scale: number; x: number; y: number };

export type StampDrawOptions = {
  style: StampStyle;
  headline: string;
  creatorName: string;
  username: string;
  treatName: string;
  supporterName?: string;
  supporterHandle?: string;
  photo?: CanvasImageSource | null;
  photoTransform?: PhotoTransform;
  qr?: CanvasImageSource | null;
  date?: Date;
};

/** Scale that makes an image cover a box without stretching it. */
export function coverScale(imgW: number, imgH: number, boxW: number, boxH: number): number {
  if (imgW <= 0 || imgH <= 0) return 1;
  return Math.max(boxW / imgW, boxH / imgH);
}

/** Keep the image's centre within the range that still covers the box. */
export function clampOffset(imgW: number, imgH: number, boxW: number, boxH: number, scale: number, x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(0, (imgW * scale - boxW) / 2);
  const maxY = Math.max(0, (imgH * scale - boxH) / 2);
  const clamp = (value: number, max: number) => {
    const v = Math.min(max, Math.max(-max, value));
    return v === 0 ? 0 : v;
  };
  return { x: clamp(x, maxX), y: clamp(y, maxY) };
}

/**
 * Shrink text to fit, then ellipsize at the minimum size. The caller must set
 * the font on the context before calling; `measureText` uses it.
 */
export function fitText(
  ctx: Pick<CanvasRenderingContext2D, "measureText" | "font">,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight: number | string = 700,
): { size: number; text: string } {
  const setFont = (size: number) => { ctx.font = `${weight} ${size}px system-ui, sans-serif`; };
  let size = startPx;
  setFont(size);
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 1;
    setFont(size);
  }
  if (ctx.measureText(text).width <= maxWidth) return { size, text };
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return { size, text: `${out.trimEnd()}…` };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function perforate(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  const r = 16;
  const step = 54;
  for (let x = step / 2; x < STAMP_W; x += step) {
    circle(ctx, x, 0, r);
    circle(ctx, x, STAMP_H, r);
  }
  for (let y = step / 2; y < STAMP_H; y += step) {
    circle(ctx, 0, y, r);
    circle(ctx, STAMP_W, y, r);
  }
  ctx.restore();
}

function drawSpacedText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number, color: string) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let x = cx - total / 2;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function dayStamp(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function sourceSize(src: CanvasImageSource): { w: number; h: number } {
  const s = src as unknown as { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  return { w: s.naturalWidth || s.width || 1, h: s.naturalHeight || s.height || 1 };
}

function drawPlaceholder(ctx: CanvasRenderingContext2D) {
  const { x, y, w, h } = PHOTO_BOX;
  ctx.fillStyle = "#EFE4D4";
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(43,22,14,.06)";
  ctx.lineWidth = 22;
  for (let i = -h; i < w + h; i += 56) {
    ctx.beginPath();
    ctx.moveTo(x + i, y);
    ctx.lineTo(x + i - h, y + h);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(43,22,14,.38)";
  ctx.font = "800 26px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawSpacedText(ctx, "YOUR PHOTO", x + w / 2, y + h / 2, 6, "rgba(43,22,14,.38)");
}

function drawPostmark(ctx: CanvasRenderingContext2D, date: Date, color: string) {
  ctx.save();
  ctx.translate(880, 258);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.globalAlpha = 0.38;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 64, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 54, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 19px system-ui, sans-serif";
  ctx.fillText("SHOW ME", 0, -14);
  ctx.fillText("LOVE", 0, 8);
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(dayStamp(date), 0, 32);
  ctx.restore();
}

/** Draw the whole 1080×1350 stamp. Pure canvas work; safe to call on every frame. */
export function drawStamp(ctx: CanvasRenderingContext2D, o: StampDrawOptions): void {
  const p = STAMP_PALETTES[o.style] ?? STAMP_PALETTES.honey;
  const date = o.date ?? new Date();

  ctx.save();
  ctx.clearRect(0, 0, STAMP_W, STAMP_H);

  // Paper and the inset printed panel.
  ctx.fillStyle = p.paper;
  ctx.fillRect(0, 0, STAMP_W, STAMP_H);

  ctx.save();
  ctx.shadowColor = "rgba(43,22,14,.22)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, 56, 56, STAMP_W - 112, STAMP_H - 112, 28);
  const panel = ctx.createLinearGradient(0, 0, STAMP_W, STAMP_H);
  panel.addColorStop(0, p.panel[0]);
  panel.addColorStop(0.55, p.panel[1]);
  panel.addColorStop(1, p.panel[2]);
  ctx.fillStyle = panel;
  ctx.fill();
  ctx.restore();

  // Headline.
  const headline = fitText(ctx, o.headline.toUpperCase(), 780, 30, 20);
  drawSpacedText(ctx, headline.text, STAMP_W / 2, 142, 9, p.soft);

  // Photo, with a paper border and a soft lift.
  const box = PHOTO_BOX;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,.18)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundRect(ctx, box.x - 12, box.y - 12, box.w + 24, box.h + 24, 30);
  ctx.fillStyle = p.paper;
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, box.x, box.y, box.w, box.h, PHOTO_RADIUS);
  ctx.clip();
  if (o.photo) {
    const { w, h } = sourceSize(o.photo);
    const base = coverScale(w, h, box.w, box.h);
    const scale = o.photoTransform?.scale ?? base;
    const offset = o.photoTransform
      ? clampOffset(w, h, box.w, box.h, scale, o.photoTransform.x, o.photoTransform.y)
      : { x: 0, y: 0 };
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(o.photo, box.x + box.w / 2 - dw / 2 + offset.x, box.y + box.h / 2 - dh / 2 + offset.y, dw, dh);
  } else {
    drawPlaceholder(ctx);
  }
  ctx.restore();

  drawPostmark(ctx, date, p.ink);

  // Creator name and handle.
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = p.ink;
  const name = fitText(ctx, o.creatorName, 820, 64, 40, 800);
  ctx.fillText(name.text, STAMP_W / 2, 962);

  ctx.fillStyle = p.soft;
  ctx.font = "600 34px system-ui, sans-serif";
  ctx.fillText(`@${o.username}`, STAMP_W / 2, 1012);

  // Supporter credit.
  const supporter = [o.supporterName, o.supporterHandle ? `@${o.supporterHandle}` : ""].filter(Boolean).join(" · ");
  if (supporter) {
    const fitted = fitText(ctx, supporter, 700, 26, 18, 600);
    const tw = ctx.measureText(fitted.text).width;
    const w = Math.min(tw + 56, 760);
    roundRect(ctx, (STAMP_W - w) / 2, 1046, w, 50, 25);
    ctx.fillStyle = "rgba(255,255,255,.20)";
    ctx.fill();
    ctx.strokeStyle = p.soft;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = p.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fitted.text, STAMP_W / 2, 1072);
  }

  // Bottom paper card: QR plus the call to action.
  ctx.save();
  ctx.shadowColor = "rgba(43,22,14,.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  roundRect(ctx, 110, 1128, 860, 134, 24);
  ctx.fillStyle = p.paper;
  ctx.fill();
  ctx.restore();

  roundRect(ctx, 126, 1140, 110, 110, 14);
  ctx.fillStyle = "#FFFFFF";
  ctx.fill();
  if (o.qr) {
    ctx.drawImage(o.qr, 132, 1146, 98, 98);
  } else {
    ctx.fillStyle = CARD_INK;
    ctx.font = "800 16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("QR", 181, 1195);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = CARD_INK;
  const treat = fitText(ctx, `Send a ${o.treatName}`, 620, 34, 24, 800);
  ctx.fillText(treat.text, 260, 1188);

  ctx.fillStyle = CARD_SOFT;
  ctx.font = "600 24px system-ui, sans-serif";
  ctx.fillText(`show-me-love/@${o.username}`, 260, 1228, 620);

  perforate(ctx);
  ctx.restore();
}
