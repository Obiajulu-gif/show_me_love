"use client";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import type { CatalogItem } from "@/lib/catalog";
import { toPageView, treatMap } from "@/lib/pageView";

import { CreatorPage } from "./CreatorPage";
import { Logo } from "./Logo";
import { TreatPicker, type TreatChoice } from "./TreatPicker";
import { UsernameField } from "./UsernameField";
import { Button } from "./ui/Button";

const STEPS = ["Treat", "Link", "About you", "Price", "Review"] as const;
const DRAFT_KEY = "sml-onboarding";
const field = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2";

type Draft = { step: number; treat: TreatChoice; username: string; name: string; bio: string; photoUrl: string | null; price: number };

function loadDraft(): Partial<Draft> {
  try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? "{}"); } catch { return {}; }
}

/** Five short steps, one decision each. Progress survives a refresh; only the link is required to be unique. */
export function OnboardingForm({ treat: t0, username: u0 }: { treat: string; username: string }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>({
    step: 0, treat: { treatId: t0, customTreat: t0 === "custom" ? { name: "", emoji: "" } : undefined },
    username: u0, name: "", bio: "", photoUrl: null, price: 500,
  });
  const [loaded, setLoaded] = useState(false);
  const [nameOk, setNameOk] = useState(false);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const saved = loadDraft();
    setD((x) => ({ ...x, ...saved, username: u0 || saved.username || "", treat: u0 ? x.treat : saved.treat ?? x.treat }));
    setLoaded(true);
    fetch("/api/treat-catalog").then((r) => r.json()).then((j) => setCatalog(j.treats ?? [])).catch(() => {});
  }, [u0]);
  useEffect(() => { if (loaded) try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {} }, [d, loaded]);
  useEffect(() => { heading.current?.focus(); }, [d.step]);

  const set = (p: Partial<Draft>) => { setErr(null); setD((x) => ({ ...x, ...p })); };
  const customOk = d.treat.treatId !== "custom" || !!d.treat.customTreat?.name.trim();
  const canNext = [customOk, nameOk, d.name.trim().length <= 50 && d.bio.length <= 280, d.price >= 100 && d.price <= 1_000_000, true][d.step];

  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData(); fd.append("file", file); fd.append("kind", "avatar");
    const r = await fetch("/api/uploads", { method: "POST", body: fd }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setBusy(false);
    if (!r?.ok) return setErr(j?.error ?? "Couldn't upload that photo.");
    set({ photoUrl: j.url });
  }

  async function finish() {
    setBusy(true); setErr(null);
    const post = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: d.username, ...d.treat }) }).catch(() => null);
    const pj = await post?.json().catch(() => ({}));
    if (!post?.ok) { setBusy(false); return setErr(pj?.error ?? "Couldn't create your page. Try again."); }
    const patch = { display_name: d.name.trim() || d.username, bio: d.bio.trim() || null, photo_url: d.photoUrl, unit_price_ngn: d.price };
    await fetch("/api/creator", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    router.push("/dashboard?welcome=1");
    router.refresh();
  }

  function next(e: FormEvent) {
    e.preventDefault();
    if (!canNext || busy) return;
    if (d.step === STEPS.length - 1) return void finish();
    set({ step: d.step + 1 });
  }

  const view = toPageView({
    username: d.username || "you", displayName: d.name || d.username || "Your name", bio: d.bio, photoUrl: d.photoUrl,
    treatId: d.treat.treatId, customTreat: d.treat.treatId === "custom" ? d.treat.customTreat : null, unitPriceNgn: d.price,
    presets: [1, 3, 5], thankYouText: "", tagline: "", accent: "honey", header: "default", coverUrl: null, socials: [],
  }, treatMap(catalog));

  return (
    <main className="min-h-screen bg-canvas px-4 py-8 text-fg">
      <div className="mx-auto flex max-w-5xl items-center justify-between"><Logo /><span className="text-sm text-muted">Step {d.step + 1} of {STEPS.length}</span></div>

      <ol className="mx-auto mt-6 grid max-w-5xl grid-cols-5 gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === d.step ? "step" : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-surface-2"><div className={`h-full rounded-full bg-accent transition-[width] duration-300 ease-out ${i < d.step ? "w-full" : i === d.step ? "w-1/2" : "w-0"}`} /></div>
            <button type="button" disabled={i > d.step} onClick={() => set({ step: i })} className={`mt-2 hidden items-center gap-1 text-xs sm:flex ${i <= d.step ? "text-fg" : "text-muted"} disabled:cursor-default`}>
              {i < d.step && <Check size={12} className="text-accent" aria-hidden />}{s}
            </button>
          </li>
        ))}
      </ol>

      <div className="mx-auto mt-8 grid max-w-5xl items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <form onSubmit={next} className="rounded-2xl border border-line bg-surface/80 p-6 shadow-lift">
          <div key={d.step} className="motion-safe:animate-dialog-in">
            {d.step === 0 && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight outline-none focus-visible:ring-0">What should people send you?</h1>
              <p className="mt-1 text-muted">Pick the treat your supporters will buy. You can change it any time.</p>
              <div className="mt-5"><TreatPicker value={d.treat} onChange={(treat) => set({ treat })} /></div>
            </>}
            {d.step === 1 && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight outline-none focus-visible:ring-0">Claim your link</h1>
              <p className="mt-1 text-muted">This is the address you&apos;ll share. 3–24 letters, numbers or underscores.</p>
              <div className="mt-5"><UsernameField value={d.username} onChange={(username) => set({ username })} onStatus={setNameOk} /></div>
            </>}
            {d.step === 2 && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight outline-none focus-visible:ring-0">Tell supporters who you are</h1>
              <p className="mt-1 text-muted">Optional, but pages with a photo and a line about you get more support.</p>
              <div className="mt-5 flex items-center gap-4">
                <label className="relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-line bg-surface-2 hover:border-accent">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.photoUrl ? <img src={d.photoUrl} alt="Your photo" className="h-full w-full object-cover" /> : busy ? <Loader2 className="motion-safe:animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Upload a photo" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                </label>
                <p className="text-sm text-muted">PNG, JPEG or WebP, up to 4 MB.</p>
              </div>
              <label className="mt-5 block text-sm font-semibold" htmlFor="ob-name">Display name</label>
              <input id="ob-name" maxLength={50} value={d.name} placeholder={d.username || "Your name"} onChange={(e) => set({ name: e.target.value })} className={`${field} mt-1`} />
              <label className="mt-4 block text-sm font-semibold" htmlFor="ob-bio">A line about you</label>
              <textarea id="ob-bio" maxLength={280} rows={3} value={d.bio} placeholder="What do you make? What keeps you going?" onChange={(e) => set({ bio: e.target.value })} className={`${field} mt-1`} />
              <p className="data mt-1 text-right text-xs text-muted">{d.bio.length}/280</p>
            </>}
            {d.step === 3 && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight outline-none focus-visible:ring-0">Price one {view.treatName.toLowerCase()}</h1>
              <p className="mt-1 text-muted">Supporters pay this in naira, settled to you in USDT. Most creators start between ₦300 and ₦1,000.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[300, 500, 1000, 2000].map((p) => (
                  <button key={p} type="button" aria-pressed={d.price === p} onClick={() => set({ price: p })}
                    className={`data rounded-full border px-4 py-1.5 transition-colors duration-150 ${d.price === p ? "border-accent bg-accent text-on-accent" : "border-line bg-surface-2 hover:border-muted/60"}`}>₦{p.toLocaleString("en-NG")}</button>
                ))}
              </div>
              <label className="mt-5 block text-sm font-semibold" htmlFor="ob-price">Or set your own (₦)</label>
              <input id="ob-price" type="number" inputMode="numeric" min={100} max={1_000_000} step={50} value={d.price} onChange={(e) => set({ price: Math.round(Number(e.target.value) || 0) })} className={`${field} data mt-1 max-w-[12rem]`} />
              {!canNext && <p className="mt-1 text-sm text-danger">Choose between ₦100 and ₦1,000,000.</p>}
            </>}
            {d.step === 4 && <>
              <h1 ref={heading} tabIndex={-1} className="font-display text-3xl font-semibold tracking-tight outline-none focus-visible:ring-0">Ready to go live</h1>
              <p className="mt-1 text-muted">Check the details. You can change any of this later from your dashboard.</p>
              <dl className="mt-5 divide-y divide-line rounded-xl border border-line">
                {[["Treat", view.treatName, 0], ["Link", `show-me-love/@${d.username}`, 1], ["Name", d.name || d.username, 2], ["Price", `₦${d.price.toLocaleString("en-NG")} each`, 3]].map(([k, v, s]) => (
                  <div key={k as string} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <dt className="text-muted">{k}</dt>
                    <dd className="flex items-center gap-3 truncate"><span className="truncate font-semibold">{v}</span><button type="button" onClick={() => set({ step: s as number })} className="text-accent underline">Edit</button></dd>
                  </div>
                ))}
              </dl>
            </>}
          </div>

          {err && <p role="alert" className="mt-4 text-sm text-danger">{err}</p>}
          <div className="mt-6 flex items-center justify-between gap-3">
            {d.step > 0 ? <Button type="button" variant="ghost" onClick={() => set({ step: d.step - 1 })}>Back</Button> : <span />}
            <div className="flex items-center gap-3">
              {d.step === 2 && <button type="button" onClick={() => set({ step: 3 })} className="text-sm text-muted underline">Skip for now</button>}
              <Button type="submit" disabled={!canNext || busy}>
                {busy && d.step === 4 ? <><Loader2 size={16} className="motion-safe:animate-spin" aria-hidden />Creating your page</> : d.step === 4 ? "Create my page" : "Continue"}
              </Button>
            </div>
          </div>
        </form>

        <aside className="hidden lg:block" aria-label="Live preview">
          <p className="mb-2 text-sm text-muted">Live preview</p>
          <CreatorPage creator={view} mode="preview" payments={[]} />
        </aside>
      </div>
    </main>
  );
}
