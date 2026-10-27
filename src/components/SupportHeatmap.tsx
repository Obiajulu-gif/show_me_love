import { heatmap } from "@/lib/heatmap";

const SHADES = ["bg-cream-2", "bg-[#E3C79B]", "bg-cocoa-2", "bg-cocoa"];
const fmt = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const text = (n: number) => (n === 0 ? "No treats this day." : n === 1 ? "1 treat" : `${n} treats`);

/** Last 12 weeks of public support. Server component; tooltips are CSS-only (hover + focus). */
export function SupportHeatmap({ dates, today = new Date() }: { dates: Date[]; today?: Date }) {
  const { weeks, months } = heatmap(dates, today);
  const empty = dates.length === 0;
  return (
    <section className="mt-6 rounded-[18px] border border-line bg-cream p-5 text-cocoa">
      <h2 className="font-serif text-lg italic">Recent support</h2>
      <p className="text-sm text-cocoa-2">The last 12 weeks</p>
      <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }}>
        {weeks.map((_, c) => (
          <span key={c} className="h-4 text-xs text-cocoa-2">{months.find((m) => m.col === c)?.label}</span>
        ))}
        {weeks.map((w, c) => (
          <div key={c} className="grid gap-1">
            {w.map((cell) => cell.future ? <span key={cell.date} aria-hidden className="aspect-square rounded-[4px]" /> : (
              <span key={cell.date} tabIndex={0} aria-label={`${fmt(cell.date)}: ${text(cell.count)}`}
                className={`group relative aspect-square rounded-[4px] border border-line ${SHADES[cell.level]} focus:outline focus:outline-2 focus:outline-honey`}>
                <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden w-max -translate-x-1/2 rounded-md bg-cocoa px-2 py-1 text-xs text-cream group-hover:block group-focus:block">
                  <b className="block">{fmt(cell.date)}</b>{text(cell.count)}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      {empty && <p className="mt-3 text-sm text-cocoa-2">Treats will show up here.</p>}
      <div className="mt-3 flex items-center justify-between text-xs text-cocoa-2">
        <span>Days shown in UTC</span>
        <span className="flex items-center gap-1">Fewer {SHADES.map((s) => <i key={s} className={`h-3 w-3 rounded-[3px] border border-line ${s}`} />)} More</span>
      </div>
    </section>
  );
}
