import { expect, test } from "vitest";

import { clampOffset, coverScale, fitText } from "@/lib/stampCanvas";

test("coverScale covers both orientations", () => {
  expect(coverScale(1000, 500, 700, 700)).toBe(1.4);
  expect(coverScale(500, 1000, 700, 700)).toBe(1.4);
  expect(coverScale(700, 700, 700, 700)).toBe(1);
  expect(coverScale(0, 0, 700, 700)).toBe(1);
});

test("clampOffset keeps the image inside the window", () => {
  expect(clampOffset(1000, 500, 700, 700, 1.4, 999, 999)).toEqual({ x: 350, y: 0 });
  expect(clampOffset(1000, 500, 700, 700, 1.4, -999, -999)).toEqual({ x: -350, y: 0 });
  expect(clampOffset(500, 1000, 700, 700, 1.4, 999, 999)).toEqual({ x: 0, y: 350 });
  expect(clampOffset(1000, 1000, 700, 700, 1, 20, -20)).toEqual({ x: 20, y: -20 });
});

function fakeCtx() {
  let px = 16;
  return {
    get font() { return `${px}px`; },
    set font(value: string) { px = Number(value.match(/(\d+)px/)?.[1] ?? 16); },
    measureText(text: string) { return { width: text.length * px * 0.6 }; },
  } as unknown as Pick<CanvasRenderingContext2D, "measureText" | "font">;
}

test("fitText leaves short text alone", () => {
  const ctx = fakeCtx();
  expect(fitText(ctx, "short", 200, 40, 20, 700)).toEqual({ size: 40, text: "short" });
});

test("fitText shrinks to fit before ellipsizing", () => {
  const ctx = fakeCtx();
  const text = "x".repeat(20);
  expect(fitText(ctx, text, 300, 40, 20, 700)).toEqual({ size: 25, text });
});

test("fitText ellipsizes at the minimum size", () => {
  const ctx = fakeCtx();
  expect(fitText(ctx, "x".repeat(30), 100, 40, 20, 700)).toEqual({ size: 20, text: "xxxxxxx…" });
});
