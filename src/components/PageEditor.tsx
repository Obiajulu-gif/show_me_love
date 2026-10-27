"use client";
import { ExternalLink, Maximize2, Minimize2, Monitor, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CreatorPage } from "./CreatorPage";
import { toPageView } from "@/lib/pageView";
import { TreatPicker, type TreatChoice } from "./TreatPicker";
import { Button, buttonClass } from "./ui/Button";
import { Tabs } from "./ui/Tabs";
import type { Creator } from "@/lib/creators";

const TABS = [{ id: "basics", label: "Basics" }, { id: "treats", label: "Treats" }, { id: "style", label: "Page style" }] as const;
type Tab = (typeof TABS)[number]["id"];

type Form = {
  username: string; displayName: string; bio: string; photoUrl: string; birthday: string; birthdayMode: string; links: string;
  treat: TreatChoice; price: string; presets: string; thanks: string; accent: string; tagline: string; header: string; coverUrl: string;
};

const input = "w-full rounded-xl border border-line bg-white px-3 py-2";
const label = "mb-1 mt-4 block text-sm font-semibold";

function fromCreator(c: Creator): Form {
  return {
    username: c.username, displayName: c.displayName ?? "", bio: c.bio ?? "", photoUrl: c.photoUrl ?? "", birthday: c.birthday ?? "",
    birthdayMode: c.birthdayMode ?? "off", links: Object.values(c.socials).join("\n"),
    treat: { treatId: c.treatId ?? "custom", customTreat: c.customTreat ?? undefined }, price: String(c.unitPriceNgn), presets: c.presets.join(", "),
    thanks: c.thankYouText ?? "", accent: c.pageStyle.accent ?? "honey", tagline: c.pageStyle.tagline ?? "", header: c.pageStyle.header ?? "default",
    coverUrl: String((c.pageStyle as { cover?: string }).cover ?? ""),
  };
}

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function toPatch(f: Form) {
  return {
    username: f.username.trim(), display_name: f.displayName.trim(), bio: f.bio, photo_url: f.photoUrl || null, birthday: f.birthday || null,
    birthday_mode: f.birthdayMode, socials: Object.fromEntries(lines(f.links).map((u, i) => [`link${i + 1}`, u])),
    treat_id: f.treat.treatId, custom_treat: f.treat.treatId === "custom" ? f.treat.customTreat ?? null : null,
    unit_price_ngn: f.price.trim() === "" ? null : Number(f.price), presets: f.presets.split(/[\s,]+/).filter(Boolean).map(Number), thank_you_text: f.thanks,
    page_style: { accent: f.accent, tagline: f.tagline, header: f.header, cover: f.coverUrl || undefined },
  };
}

export function PageEditor({ creator, treats }: { creator: Creator; treats: Record<string, { name: string; image: string }> }) {
  const router = useRouter();
  const [saved, setSaved] = useState(() => JSON.stringify(toPatch(fromCreator(creator))));
  const [f, setF] = useState(() => fromCreator(creator));
  const [tab, setTab] = useState<Tab>("basics");
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [liveName, setLiveName] = useState(creator.username);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF((p) => ({ ...p, [k]: v })); setMsg(null); };
  const dirty = JSON.stringify(toPatch(f)) !== saved;
  const idx = TABS.findIndex((t) => t.id === tab);

  const view = toPageView({
    username: f.username || creator.username, displayName: f.displayName, bio: f.bio, photoUrl: f.photoUrl || null,
    treatId: f.treat.treatId, customTreat: f.treat.treatId === "custom" ? f.treat.customTreat : null, unitPriceNgn: Number(f.price),
    presets: f.presets.split(/[\s,]+/).filter(Boolean).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 50),
    thankYouText: f.thanks, tagline: f.tagline, accent: f.accent, header: f.header, coverUrl: f.coverUrl || null, socials: lines(f.links),
  }, treats);

  async function upload(kind: "avatar" | "cover", file?: File) {
    if (!file) return;
    const body = new FormData();
    body.set("file", file);
    body.set("kind", kind);
    const r = await fetch("/api/uploads", { method: "POST", body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? "Upload failed." });
    set(kind === "avatar" ? "photoUrl" : "coverUrl", d.url);
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/creator", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(toPatch(f)) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error ?? "Could not save." });
    const next = fromCreator(d.creator as Creator);
    setF(next);
    setSaved(JSON.stringify(toPatch(next)));
    setLiveName(d.creator.username);
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  const preview = (
    <div className={device === "mobile" ? "mx-auto w-full max-w-[360px]" : "mx-auto w-full max-w-[720px]"}>
      <CreatorPage creator={view} mode="preview" payments={[]} />
    </div>
  );

  return (
    <div className="pb-28">
      <h1 className="font-serif text-3xl italic">Make your page yours.</h1>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section aria-label="Page settings">
          <Tabs tabs={TABS} value={tab} onChange={setTab} label="Page sections" />
          {tab === "basics" && (
            <div>
              <label htmlFor="displayName" className={label}>Display name</label>
              <input id="displayName" className={input} maxLength={50} value={f.displayName} onChange={(e) => set("displayName", e.target.value)} />
              <label htmlFor="username" className={label}>Username</label>
              <input id="username" className={input} maxLength={24} value={f.username} onChange={(e) => set("username", e.target.value.toLowerCase())} />
              <p className="mt-1 text-xs text-cocoa-2">Your old link keeps working and redirects here.</p>
              <label htmlFor="bio" className={label}>Bio <span className="font-normal text-cocoa-2">({f.bio.length}/280)</span></label>
              <textarea id="bio" className={input} rows={3} maxLength={280} value={f.bio} onChange={(e) => set("bio", e.target.value)} />
              <label htmlFor="avatar" className={label}>Photo</label>
              <input id="avatar" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload("avatar", e.target.files?.[0])} />
              <p className="mt-1 text-xs text-cocoa-2">PNG, JPEG or WebP, up to 4 MB.</p>
              <label htmlFor="links" className={label}>Social links <span className="font-normal text-cocoa-2">(one https:// link per line, up to 6)</span></label>
              <textarea id="links" className={input} rows={3} value={f.links} onChange={(e) => set("links", e.target.value)} />
              <label htmlFor="birthday" className={label}>Birthday</label>
              <div className="flex gap-2">
                <input id="birthday" type="date" className={input} value={f.birthday} onChange={(e) => set("birthday", e.target.value)} />
                <select aria-label="Birthday on your page" className={input} value={f.birthdayMode} onChange={(e) => set("birthdayMode", e.target.value)}>
                  <option value="off">Keep private</option>
                  <option value="show_day">Show the day</option>
                  <option value="celebrate">Celebrate it</option>
                </select>
              </div>
            </div>
          )}
          {tab === "treats" && (
            <div>
              <p className={label}>Your treat</p>
              <TreatPicker value={f.treat} onChange={(v) => set("treat", v)} />
              <label htmlFor="price" className={label}>Price per treat (₦)</label>
              <input id="price" className={input} inputMode="numeric" value={f.price} onChange={(e) => set("price", e.target.value)} />
              <p className="mt-1 text-xs text-cocoa-2">Between ₦100 and ₦1,000,000.</p>
              <label htmlFor="presets" className={label}>Quantity buttons</label>
              <input id="presets" className={input} value={f.presets} onChange={(e) => set("presets", e.target.value)} />
              <p className="mt-1 text-xs text-cocoa-2">Up to 3 different numbers from 1 to 50, separated by commas.</p>
              <label htmlFor="thanks" className={label}>Thank-you line <span className="font-normal text-cocoa-2">({f.thanks.length}/120)</span></label>
              <input id="thanks" className={input} maxLength={120} value={f.thanks} onChange={(e) => set("thanks", e.target.value)} />
            </div>
          )}
          {tab === "style" && (
            <div>
              <label htmlFor="tagline" className={label}>Tagline</label>
              <input id="tagline" className={input} maxLength={80} value={f.tagline} onChange={(e) => set("tagline", e.target.value)} />
              <label htmlFor="accent" className={label}>Accent colour</label>
              <select id="accent" className={input} value={f.accent} onChange={(e) => set("accent", e.target.value)}>
                <option value="honey">Honey</option><option value="cocoa">Cocoa</option><option value="sage">Sage</option>
              </select>
              <label htmlFor="header" className={label}>Header</label>
              <select id="header" className={input} value={f.header} onChange={(e) => set("header", e.target.value)}>
                <option value="default">Solid colour</option><option value="cover">Cover image</option>
              </select>
              {f.header === "cover" && (
                <>
                  <label htmlFor="cover" className={label}>Cover image</label>
                  <input id="cover" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => upload("cover", e.target.files?.[0])} />
                  <p className="mt-1 text-xs text-cocoa-2">PNG, JPEG or WebP, up to 4 MB.</p>
                </>
              )}
            </div>
          )}
        </section>

        <section aria-label="Preview" className={expanded ? "fixed inset-0 z-50 overflow-auto bg-cream p-6" : "lg:sticky lg:top-6 lg:self-start"}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <Tabs tabs={[{ id: "mobile", label: "Mobile" }, { id: "desktop", label: "Desktop" }] as const} value={device} onChange={setDevice} label="Preview size" />
            <div className="flex items-center gap-2">
              <button type="button" aria-label={expanded ? "Shrink preview" : "Expand preview"} onClick={() => setExpanded(!expanded)} className="rounded-lg border border-line bg-white p-2 hover:bg-cream-2">
                {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <Link href={`/@${liveName}`} target="_blank" className={buttonClass("ghost", "py-1.5 text-sm")}>View live page <ExternalLink size={14} /></Link>
            </div>
          </div>
          <p className="mb-2 flex items-center gap-1 text-xs text-cocoa-2">{device === "mobile" ? <Smartphone size={12} /> : <Monitor size={12} />} Live preview, updates as you type</p>
          {preview}
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-4 py-3 backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <p role="status" className={`min-w-0 flex-1 truncate text-sm ${msg?.ok === false ? "text-red-700" : "text-cocoa-2"}`}>{msg?.text ?? (dirty ? "You have unsaved changes." : "")}</p>
          <Button variant="ghost" disabled={idx === 0} onClick={() => setTab(TABS[idx - 1].id)}>Prev</Button>
          <Button variant="ghost" disabled={idx === TABS.length - 1} onClick={() => setTab(TABS[idx + 1].id)}>Next</Button>
          <Button disabled={!dirty || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
