/** Presentational creator page. Used for the landing-page sample now; the dashboard preview and public page reuse it. */
export type CreatorPageData = {
  username: string; displayName: string; bio: string; treatName: string; treatImage: string; unitPriceNgn: number; presets: number[];
  tagline: string; recent: { name: string; count: number; message: string }[];
};

export function CreatorPage({ data }: { data: CreatorPageData }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-cream">
      <div className="h-20 bg-honey" />
      <div className="px-6 pb-6">
        <div className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full border-4 border-cream bg-cream-2 font-serif text-2xl italic">{data.displayName[0]}</div>
        <h3 className="mt-2 text-xl font-semibold">{data.displayName}</h3>
        <p className="text-sm text-cocoa-2">show-me-love/@{data.username}</p>
        <p className="mt-2 text-sm">{data.bio}</p>
        <div className="mt-4 rounded-[18px] border border-line bg-cream-2 p-4">
          <p className="font-serif italic text-cocoa-2">{data.tagline}</p>
          <div className="mt-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.treatImage} alt="" className="h-12 w-12" />
            <span className="text-sm">{data.treatName} x</span>
            {data.presets.map((n, i) => (
              <span key={n} className={`rounded-full border px-3 py-1 text-sm ${i === 1 ? "border-cocoa bg-honey" : "border-line bg-white"}`}>{n}</span>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-honey px-4 py-2 text-center font-semibold text-honey-ink shadow-[0_4px_0_#3B2416]">
            Send ₦{(data.unitPriceNgn * data.presets[1]).toLocaleString("en-NG")}
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-sm">
          {data.recent.map((r) => (
            <li key={r.name} className="rounded-xl bg-white px-3 py-2"><b>{r.name}</b> sent {r.count} {data.treatName.toLowerCase()}{r.count > 1 ? "s" : ""}. {r.message}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
