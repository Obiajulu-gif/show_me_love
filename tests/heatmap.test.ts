import { expect, test } from "vitest";

import { heatmap } from "../src/lib/heatmap";

const today = new Date("2026-10-26T10:00:00Z"); // a Monday

test("12 weeks of 7 days, last column starts on today's Monday", () => {
  const h = heatmap([], today);
  expect(h.weeks).toHaveLength(12);
  expect(h.weeks.every((w) => w.length === 7)).toBe(true);
  expect(h.weeks[11][0].date).toBe("2026-10-26");
  expect(h.weeks[0][0].date).toBe("2026-08-10");
});

test("same-day dates count together and set the level", () => {
  const d = new Date("2026-10-20T08:00:00Z");
  const cell = heatmap([d, d], today).weeks[10].find((c) => c.date === "2026-10-20")!;
  expect(cell).toMatchObject({ count: 2, level: 2 });
});

test("levels: 1 -> 1, 2-3 -> 2, 4+ -> 3", () => {
  const mk = (n: number) => heatmap(Array(n).fill(new Date("2026-10-20T08:00:00Z")), today).weeks[10][1].level;
  expect([mk(1), mk(2), mk(3), mk(4), mk(9)]).toEqual([1, 2, 2, 3, 3]);
});

test("dates older than 84 days are ignored", () => {
  const old = new Date(today.getTime() - 84 * 864e5);
  expect(heatmap([old], today).weeks.flat().reduce((s, c) => s + c.count, 0)).toBe(0);
});

test("23:30 UTC lands on the UTC date", () => {
  const h = heatmap([new Date("2026-10-19T23:30:00Z")], today);
  expect(h.weeks[10][0]).toMatchObject({ date: "2026-10-19", count: 1 });
});

test("cells after today are empty and uncounted", () => {
  const wed = new Date("2026-10-28T10:00:00Z");
  const h = heatmap([new Date("2026-10-30T10:00:00Z")], wed);
  expect(h.weeks[11][2].date).toBe("2026-10-28");
  expect(h.weeks[11][3]).toMatchObject({ date: "2026-10-29", count: 0, future: true });
  expect(h.weeks[11][4].count).toBe(0);
});

test("month labels sit on the first column a month starts", () => {
  const h = heatmap([], today);
  expect(h.months).toEqual([{ label: "Aug", col: 0 }, { label: "Sept", col: 3 }, { label: "Oct", col: 7 }]);
});
