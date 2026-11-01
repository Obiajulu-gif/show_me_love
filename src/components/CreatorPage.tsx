import { BuyCard } from "./BuyCard";

/** Everything the page needs to draw itself. Built from a saved creator or from unsaved editor state. */
export type PageView = {
  username: string; displayName: string; bio: string; photoUrl: string | null; treatName: string; treatImage: string;
  unitPriceNgn: number; presets: number[]; thankYouText: string; tagline: string; accent: string; header: string; coverUrl: string | null;
  socials: string[];
};
export type WallEntry = { id: string; name: string; message: string; quantity: number; at: Date };

const ACCENT: Record<string, string> = {
  honey: "linear-gradient(135deg,#F4B36A,#E96B5C 55%,#8E3B51)",
  cocoa: "linear-gradient(135deg,#2A221B,#171310)",
  sage: "linear-gradient(135deg,#9FE3D3,#17B394 60%,#0E7C66)",
};

const SOCIALS: Record<string, string> = {
  "instagram.com": "Instagram", "x.com": "X", "twitter.com": "X / Twitter", "youtube.com": "YouTube",
  "tiktok.com": "TikTok", "github.com": "GitHub", "linkedin.com": "LinkedIn", "facebook.com": "Facebook",
  "threads.net": "Threads", "twitch.tv": "Twitch",
};

function socialLabel(raw: string) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    return SOCIALS[host] ?? host;
  } catch {
    return raw.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

function when(at: Date) {
  const ms = Date.now() - new Date(at).getTime();
  if (ms < 60_000) return "just now";
  if (ms < 3_600_000) return `${Math.max(1, Math.floor(ms / 60_000))}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.floor(ms / 86_400_000)}d ago`;
  return new Date(at).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Presentational only: no data fetching, so the editor can render it from unsaved form state. */
export function CreatorPage({ creator: c, mode, payments }: { creator: PageView; mode: "preview" | "live"; payments: WallEntry[] }) {
  const cover = c.header === "cover" && c.coverUrl;
  const name = c.displayName || c.username;
  const socials = c.socials.filter((u) => /^https:\/\//i.test(u));
  return (
    <div className="theme-paper overflow-hidden rounded-[24px] border border-line bg-surface text-fg shadow-paper-lift">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.coverUrl!} alt="" className="h-36 w-full object-cover sm:h-40" />
      ) : <div className="h-36 w-full sm:h-40" style={{ background: ACCENT[c.accent] ?? ACCENT.honey }} />}
      <div className="px-5 pb-7 sm:px-7">
        <div className="-mt-10 flex h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-accent font-display text-[31px] font-extrabold text-on-accent shadow-paper sm:h-20 sm:w-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {c.photoUrl ? <img src={c.photoUrl} alt="" className="h-full w-full object-cover" /> : (name[0] ?? "?")}
        </div>
        <h1 data-testid="page-name" className="mt-3 font-display text-[27px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[30px]">{name}</h1>
        <p className="mt-0.5 text-[13px] text-muted">show-me-love/@{c.username}</p>
        {c.bio && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">{c.bio}</p>}
        {c.tagline && <p className="mt-3 font-serif text-[18px] italic leading-snug text-muted">{c.tagline}</p>}
        {socials.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {socials.map((u) => (
              <a key={u} href={u} rel="noopener noreferrer nofollow" target="_blank"
                className="rounded-full border border-line bg-canvas px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:border-accent/50 hover:text-fg">
                {socialLabel(u)}
              </a>
            ))}
          </div>
        )}
        <div className="mt-5">
          <BuyCard creatorName={name} treatName={c.treatName} treatImage={c.treatImage} unitPriceNgn={c.unitPriceNgn} presets={c.presets} mode={mode} username={c.username} />
        </div>

        <section className="mt-8 border-t border-line pt-6" aria-labelledby="supporters-notes">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="supporters-notes" className="font-display text-xl font-bold tracking-tight">Notes from supporters</h2>
            <span className="text-[11px] text-muted">{payments.length ? `${payments.length} public` : "Be the first"}</span>
          </div>
          {payments.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {payments.map((r) => {
                const total = c.unitPriceNgn * r.quantity;
                const treat = `${r.quantity} ${c.treatName.toLowerCase()}${r.quantity > 1 ? "s" : ""}`;
                return (
                  <li key={r.id} className="rounded-2xl border border-line bg-[#FFFDF8] p-4 shadow-paper">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 font-display text-xs font-extrabold text-accent">{(r.name[0] ?? "?").toUpperCase()}</span>
                      <div className="min-w-0">
                        <b className="block truncate text-[12.5px] leading-tight">{r.name}</b>
                        <small className="block text-[11px] text-muted">{treat} · ₦{total.toLocaleString("en-NG")}</small>
                      </div>
                    </div>
                    <p className="mt-2.5 font-serif text-[18px] italic leading-[1.3] text-fg">“{r.message}”</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
                      <b className="font-semibold text-fg" suppressHydrationWarning>{when(r.at)}</b>
                      <span>public</span>
                      <span className="ml-auto text-[13px] text-accent" aria-label="Love">♥</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 rounded-2xl border border-dashed border-line bg-canvas px-4 py-5 text-sm text-muted">No notes yet. Yours could be the first.</p>
          )}
        </section>
      </div>
    </div>
  );
}
