import { BuyCard } from "./BuyCard";

/** Everything the page needs to draw itself. Built from a saved creator or from unsaved editor state. */
export type PageView = {
  username: string; displayName: string; bio: string; photoUrl: string | null; treatName: string; treatImage: string;
  unitPriceNgn: number; presets: number[]; thankYouText: string; tagline: string; accent: string; header: string; coverUrl: string | null;
  socials: string[];
};
export type WallEntry = { id: string; name: string; message: string; quantity: number; at: Date };

const ACCENT: Record<string, string> = { honey: "bg-gradient-to-br from-accent/70 via-accent/25 to-surface-2", cocoa: "bg-gradient-to-br from-surface-2 to-canvas", sage: "bg-gradient-to-br from-love/70 via-love/25 to-surface-2" };

/** Presentational only: no data fetching, so the editor can render it from unsaved form state. */
export function CreatorPage({ creator: c, mode, payments }: { creator: PageView; mode: "preview" | "live"; payments: WallEntry[] }) {
  const cover = c.header === "cover" && c.coverUrl;
  return (
    <div className="overflow-hidden rounded-[18px] border border-line bg-canvas text-fg">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl!} alt="" className="h-24 w-full object-cover" />
      ) : <div className={`h-24 ${ACCENT[c.accent] ?? ACCENT.accent}`} />}
      <div className="px-6 pb-6">
        <div className="-mt-8 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-canvas bg-surface font-display text-2xl font-semibold tracking-tight">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-full w-full object-cover" /> : (c.displayName[0] ?? "?")}
        </div>
        <h3 data-testid="page-name" className="mt-2 text-xl font-semibold">{c.displayName || c.username}</h3>
        <p className="text-sm text-muted">show-me-love/@{c.username}</p>
        {c.bio && <p className="mt-2 whitespace-pre-line text-sm">{c.bio}</p>}
        {c.socials.length > 0 && (
          <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted">
            {c.socials.filter((u) => /^https:\/\//i.test(u)).map((u) => <a key={u} href={u} rel="noopener noreferrer nofollow" target="_blank" className="underline">{u.replace(/^https:\/\/(www\.)?/, "")}</a>)}
          </p>
        )}
        <div className="mt-4">
          <p className="font-display text-muted">{c.tagline}</p>
          <BuyCard treatName={c.treatName} treatImage={c.treatImage} unitPriceNgn={c.unitPriceNgn} presets={c.presets} mode={mode} username={c.username} />
        </div>
        <h4 className="mt-6 font-display text-lg font-semibold tracking-tight">Notes from supporters</h4>
        {payments.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm">
            {payments.map((r) => (
              <li key={r.id} className="rounded-xl bg-surface-2 px-3 py-2"><b>{r.name}</b> sent {r.quantity} {c.treatName.toLowerCase()}{r.quantity > 1 ? "s" : ""}. {r.message}</li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted">No notes yet. Yours could be the first.</p>}
      </div>
    </div>
  );
}
