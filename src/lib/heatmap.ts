export type HeatCell = { date: string; count: number; level: 0 | 1 | 2 | 3; future?: boolean };

const DAY = 864e5;
const WEEKS = 12;
const level = (n: number): 0 | 1 | 2 | 3 => (n >= 4 ? 3 : n >= 2 ? 2 : n >= 1 ? 1 : 0);
const month = (ms: number) => new Date(ms).toLocaleString("en-GB", { month: "short", timeZone: "UTC" });

/** 12 Monday-start weeks ending with the week of `today` (UTC). Dates outside the grid are ignored. */
export function heatmap(dates: Date[], today: Date): { weeks: HeatCell[][]; months: { label: string; col: number }[] } {
  const t0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const start = t0 - ((today.getUTCDay() + 6) % 7) * DAY - (WEEKS - 1) * 7 * DAY;
  const counts = new Map<string, number>();
  for (const d of dates) {
    const k = new Date(d).toISOString().slice(0, 10);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const weeks: HeatCell[][] = [];
  const months: { label: string; col: number }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const ms = start + (w * 7 + d) * DAY;
      const date = new Date(ms).toISOString().slice(0, 10);
      if (ms > t0) col.push({ date, count: 0, level: 0, future: true });
      else { const count = counts.get(date) ?? 0; col.push({ date, count, level: level(count) }); }
      if (d === 0 && w === 0) months.push({ label: month(ms), col: 0 });
      else if (ms <= t0 && date.endsWith("-01")) months.push({ label: month(ms), col: w });
    }
    weeks.push(col);
  }
  return { weeks, months };
}
