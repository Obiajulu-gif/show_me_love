import { ArrowDownToLine, ArrowRight, Check, Code2, Gift, Heart, LayoutGrid, Link2, Target, User } from "lucide-react";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { buttonClass } from "@/components/ui/Button";

const wrap = "mx-auto w-full max-w-[1180px] px-5";
const display = "font-display font-bold tracking-[-0.045em]";
const kicker = "inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-muted";

const notes = [
  { name: "Tunde", treat: "3 zobo", amount: "₦1,500", message: "Your sourdough saved my weekend.", when: "2h ago", creator: "Ada Bakes", image: "/treats/zobo.webp" },
  { name: "Ife", treat: "1 suya", amount: "₦800", message: "Keep going — we’re watching.", when: "5h ago", creator: "Tobi Codes", image: "/treats/suya.webp" },
  { name: "Kemi", treat: "5 jollof", amount: "₦2,500", message: "For the Friday recipes.", when: "1d ago", creator: "Ada Bakes", image: "/treats/jollof.webp" },
  { name: "Tobi", treat: "2 coffee", amount: "₦1,200", message: "Sent from Abuja. Keep building.", when: "2d ago", creator: "Kemi Draws", image: "/treats/coffee.webp" },
];

const steps = [
  {
    title: "Your page",
    body: "A photo, a line about you, your treat and the notes people leave. It looks like you, not a payment form.",
  },
  {
    title: "Your people",
    body: "One link in your bio. They pick a treat, add a note, and pay in naira — no account, no app.",
  },
  {
    title: "Your money",
    body: "See exactly what arrived in USDT. Withdraw to your bank or wallet, with the fee shown first.",
  },
];

const faq = [
  ["How do supporters pay?", "They choose a treat and a quantity, then pay the naira total through Roqqu. The equivalent arrives in USDT."],
  ["What does it cost?", "A small platform fee is taken from each treat, and bank withdrawals carry a flat payout fee. Both are shown before you confirm."],
  ["How do I get my money?", "Withdraw as USDT to a BEP20 or TRC20 wallet, or to a Nigerian bank account. New accounts get a short review window on their first withdrawals."],
  ["Can I raise money for something specific?", "Yes. Set a goal with a target and a story, and supporters can see progress. You can also accept support as a group."],
  ["Can I connect it to my own app?", "Yes. The developer Connect API lets your app read your support link and earnings with your permission."],
] as const;

function HeroPageCard() {
  return (
    <div className="relative z-10 w-full max-w-[432px] rounded-[24px] border border-line bg-surface shadow-paper-lift">
      <div className="relative h-[148px] overflow-hidden rounded-t-[24px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/treats/zobo.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#140A05]/20" aria-hidden />
      </div>
      <div className="px-5 pb-6 sm:px-6 relative">
        {/* Overlaps the image/content seam without magic flow margins; never clipped by card overflow. */}
        <div className="absolute -top-[38px] left-5 z-20 flex h-[76px] w-[76px] items-center justify-center rounded-full border-[5px] border-surface bg-accent font-display text-[31px] font-extrabold text-on-accent">A</div>
        <p className="mt-2.5 font-display text-[25px] font-extrabold leading-tight tracking-[-0.035em]">Ada Bakes</p>
        <p className="text-[12.5px] text-muted">show-me-love/@ada_bakes</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted">Baking tutorials every Friday. Fuel me with zobo.</p>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {["IG", "X", "YT"].map((s) => <span key={s} className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-canvas text-[9.5px] font-extrabold text-muted">{s}</span>)}
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-[#FFFDF8] p-3.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/treats/zobo.webp" alt="" className="h-[50px] w-[50px] rounded-[13px] border border-line object-cover" />
            <div>
              <b className="block text-[13.5px] leading-tight">Buy Ada a zobo</b>
              <small className="mt-0.5 block text-[11.5px] text-muted">₦500 each</small>
            </div>
            <div className="ml-auto flex overflow-hidden rounded-[10px] border border-line bg-surface text-[12px] font-bold" aria-hidden>
              <span className="border-r border-line px-2.5 py-1.5 text-muted">1</span>
              <span className="border-r border-line bg-fg px-2.5 py-1.5 text-canvas">3</span>
              <span className="border-r border-line px-2.5 py-1.5 text-muted">5</span>
              <span className="px-2 py-1.5 text-[10.5px] text-muted">Custom</span>
            </div>
          </div>
          <div className="mt-3 grid gap-1.5" aria-hidden>
            {["Your name (optional)", "Email — for your receipt", "Leave a note for Ada"].map((f) => (
              <div key={f} className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[11.5px] text-muted">{f}</div>
            ))}
          </div>
          <div className="mt-2.5 rounded-[11px] bg-accent px-3 py-2.5 text-center text-[12.5px] font-extrabold text-on-accent">Send 3 zobo · ₦1,500</div>
          <p className="mt-2 text-center text-[10px] text-muted">Paid securely in USDT via Roqqu</p>
        </div>
      </div>
    </div>
  );
}

function NoteSlip({ note, className = "" }: { note: (typeof notes)[number]; className?: string }) {
  return (
    <article className={`rounded-2xl border border-line bg-[#FFFDF8] p-4 shadow-paper sm:p-5 ${className}`}>
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={note.image} alt="" className="h-8 w-8 rounded-full border border-line object-cover" />
        <div className="min-w-0">
          <b className="block truncate text-[12.5px] leading-tight">{note.name}</b>
          <small className="block text-[10.5px] text-muted">{note.treat} · {note.amount}</small>
        </div>
      </div>
      <p className="mt-3 font-serif text-[17px] italic leading-[1.3] text-fg sm:text-[18px]">“{note.message}”</p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted">
        <b className="font-semibold text-fg">{note.when}</b>
        <span className="truncate">on {note.creator}</span>
        <span className="ml-auto text-[13px] text-accent" aria-label="Love">♥</span>
      </div>
    </article>
  );
}

function HowArt({ index }: { index: number }) {
  if (index === 0) return (
    <>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-accent font-display font-extrabold text-on-accent">A</span>
        <div><b className="block text-[12.5px]">Ada Bakes</b><small className="block text-[10.5px] text-muted">show-me-love/@ada_bakes</small></div>
      </div>
      <div className="mt-2.5 flex items-center gap-2 border-t border-dashed border-line pt-2 text-[11px] text-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/treats/zobo.webp" alt="" className="h-[26px] w-[26px] rounded-full object-cover" /> Buy Ada a zobo
        <span className="ml-auto font-extrabold text-fg">₦500</span>
      </div>
    </>
  );
  if (index === 1) return (
    <div className="text-[11px] text-muted">
      Tunde sent 3 zobo
      <b className="mt-1.5 block font-serif text-[15px] font-normal italic leading-[1.3] text-fg">“Your sourdough saved my weekend.”</b>
    </div>
  );
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="min-w-[84px] rounded-[10px] border border-line bg-surface px-2.5 py-2 text-center">
        <small className="block text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-muted">They pay</small>
        <b className="mt-0.5 block text-[13px]">₦1,500</b>
      </div>
      <span className="text-xs font-bold text-muted" aria-hidden>→</span>
      <div className="min-w-[84px] rounded-[10px] border border-line bg-surface px-2.5 py-2 text-center">
        <small className="block text-[8.5px] font-extrabold uppercase tracking-[0.07em] text-muted">You receive</small>
        <b className="mt-0.5 block text-[13px]">1.00 USDT</b>
      </div>
    </div>
  );
}

function EditorMock() {
  return (
    <div className="grid gap-3 rounded-xl border border-line bg-canvas p-3 min-[420px]:grid-cols-2">
      <div className="space-y-2">
        {[["Tagline", "A little love. A lot of possibility."], ["Bio", "Baking tutorials every Friday. Fuel me with zobo."], ["Accent colour", "Teal"], ["Header", "Cover photo"], ["Social links", "Instagram, X, YouTube"]].map(([label, value]) => (
          <div key={label}>
            <span className="block text-[8px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</span>
            <div className={`mt-1 rounded-md border border-line bg-surface px-2 py-1.5 text-[10.5px] text-muted ${label === "Bio" ? "min-h-[42px]" : ""}`}>{value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-col overflow-hidden rounded-[10px] border border-line bg-surface">
        <div className="h-14" style={{ background: "linear-gradient(135deg,#F4B36A,#E96B5C 55%,#8E3B51)" }} />
        <div className="flex flex-1 flex-col px-2.5 pb-3">
          <span className="-mt-4 flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-surface bg-accent font-display text-[11px] font-extrabold text-on-accent">A</span>
          <b className="mt-1.5 font-display text-[12px] font-extrabold tracking-tight">Ada Bakes</b>
          <small className="text-[8px] text-muted">@ada_bakes</small>
          <p className="mt-1.5 text-[8.5px] leading-snug text-muted">Baking tutorials every Friday. Fuel me with zobo.</p>
          <div className="mt-2 flex items-center gap-1.5 rounded-md border border-line bg-canvas p-1.5 text-[8px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/treats/zobo.webp" alt="" className="h-5 w-5 rounded-full object-cover" /> Zobo<span className="ml-auto font-bold">₦500</span>
          </div>
          <div className="mt-1.5 rounded-md bg-accent py-1.5 text-center text-[8px] font-extrabold text-on-accent">Send 3 zobo · ₦1,500</div>
          <div className="mt-auto border-t border-dashed border-line pt-2">
            <span className="block text-[7px] font-extrabold uppercase tracking-[0.12em] text-muted">Notes</span>
            <b className="mt-0.5 block text-[8px]">Tunde</b>
            <span className="mt-0.5 block font-serif text-[11px] italic leading-tight text-muted">“Your sourdough saved my weekend.”</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardMock() {
  const nav = [
    { label: "Overview", Icon: LayoutGrid, on: true },
    { label: "Your page", Icon: User },
    { label: "Treats", Icon: Gift },
    { label: "Goals", Icon: Target },
    { label: "Share", Icon: Link2 },
    { label: "Withdrawals", Icon: ArrowDownToLine },
    { label: "Developers", Icon: Code2 },
  ];
  return (
    <div className="rounded-[20px] border border-line bg-surface p-2.5 shadow-paper-lift">
      <div className="grid overflow-hidden rounded-xl border border-line bg-canvas sm:grid-cols-[150px_1fr]">
        <aside className="hidden border-r border-line bg-surface-2/50 p-3 text-[10.5px] text-muted sm:block">
          <div className="mb-4 flex items-center gap-1.5 font-display text-[11px] font-extrabold text-fg">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-fg text-[8px] text-accent">♥</span> show-me-love
          </div>
          {nav.map(({ label, Icon, on }) => (
            <div key={label} className={`mb-0.5 flex items-center gap-2 rounded-md px-2 py-1.5 ${on ? "bg-accent/10 font-bold text-accent shadow-[inset_2px_0_0_rgb(var(--accent))]" : ""}`}>
              <Icon size={12} aria-hidden />{label}
            </div>
          ))}
        </aside>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-[16px] font-bold tracking-tight text-fg">Good evening, Ada</h3>
              <p className="mt-0.5 text-[10px] text-muted">Your page is live · 12 supporters this month</p>
            </div>
            <span className="rounded-md bg-accent px-2.5 py-1.5 text-[9.5px] font-extrabold text-on-accent">Share my page</span>
          </div>
          <div className="mt-3 grid grid-cols-[1.15fr_.85fr] gap-2">
            <div className="rounded-xl border border-line bg-surface p-3">
              <small className="text-[8.5px] font-bold uppercase tracking-[0.09em] text-muted">Available balance</small>
              <b className="mt-1 block font-display text-[25px] leading-none tracking-[-0.03em] text-green">12.40 <span className="text-[11px] text-muted">USDT</span></b>
              <span className="mt-1 block text-[9px] text-muted">about ₦19,840 · 1 USDT = ₦1,600</span>
              <span className="mt-2 inline-block rounded-md bg-accent px-2.5 py-1.5 text-[9px] font-extrabold text-on-accent">Withdraw</span>
            </div>
            <div className="grid gap-2">
              <div className="rounded-xl border border-line bg-surface-2 p-2.5">
                <small className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">Received this month</small>
                <b className="mt-0.5 block font-display text-[18px]">+18.20 USDT</b>
                <span className="text-[8.5px] text-green">↑ 24% vs last month</span>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 p-2.5">
                <small className="text-[8px] font-bold uppercase tracking-[0.08em] text-muted">Treats received</small>
                <b className="mt-0.5 block font-display text-[18px]">18</b>
                <span className="text-[8.5px] text-green">↑ 6 this week</span>
              </div>
            </div>
          </div>
          <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
            <div className="flex items-center justify-between text-[9.5px] text-muted"><b className="text-fg">Page setup · 2 of 3</b><span>Almost there</span></div>
            {[["Create your page", true], ["Add a photo and a short bio", true], ["Share your page", false]].map(([label, done]) => (
              <div key={label as string} className="mt-1 flex items-center gap-1.5 text-[9px] text-muted">
                <span className={`flex h-3 w-3 items-center justify-center rounded-full border ${done ? "border-accent bg-accent/20 text-accent" : "border-line"}`}>{done ? "✓" : ""}</span>{label}
              </div>
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-line bg-surface-2 p-3">
            {[["T", "Tunde", "3 zobo", "“Your sourdough saved my weekend.”", "+1.00"], ["I", "Ife", "1 zobo", "“Keep going!”", "+0.33"]].map(([av, name, treat, quote, amt]) => (
              <div key={name} className="flex items-center gap-2 border-b border-line py-1.5 text-[9px] text-muted last:border-0 last:pb-0 first:pt-0">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-line text-[8px] font-extrabold text-fg">{av}</span>
                <div className="min-w-0"><b className="text-fg">{name}</b> sent {treat} <span className="font-serif text-[10.5px] italic text-muted">· {quote}</span></div>
                <span className="ml-auto shrink-0 font-bold text-green">{amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="theme-paper min-h-screen bg-canvas text-fg">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute -right-40 -top-64 h-[820px] w-[820px] rounded-full" style={{ background: "radial-gradient(circle,rgba(240,103,90,.14),rgba(240,103,90,0) 62%)" }} />
          <div className={`${wrap} relative grid items-center gap-12 py-12 sm:py-14 lg:grid-cols-[minmax(0,.94fr)_minmax(0,1.06fr)] lg:gap-[54px] lg:py-20`}>
            <div className="min-w-0">
              <p className={kicker}><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />For bakers, streamers, writers, designers</p>
              <h1 className={`${display} mt-5 max-w-[14ch] text-[clamp(3.1rem,6.2vw,5.9rem)] leading-[0.93] tracking-[-0.055em]`}>
                Get paid for the <em className="font-serif font-normal italic tracking-[-0.02em] text-accent">small things</em> that keep you going.
              </h1>
              <p className="mt-6 max-w-[45ch] text-[17px] leading-[1.55] text-muted sm:text-[18.5px]">
                One link. Zobo, suya, jollof — or your own treat. Your people support you in naira; you get paid in USDT and withdraw to your bank or wallet.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-2.5">
                <Link href="/signup" className={buttonClass("primary", "rounded-full px-5 py-3 text-[15px]")}>Start my page — it&apos;s free <ArrowRight size={16} aria-hidden /></Link>
                <Link href="/@hello" className={buttonClass("ghost", "rounded-full px-5 py-3 text-[15px]")}>See a real page</Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
                <b className="font-semibold text-fg">No monthly fee</b><span aria-hidden>·</span>Live in under a minute<span aria-hidden>·</span>Withdraw anytime
              </p>
            </div>

            <div className="relative flex min-w-0 justify-end pb-7">
              <div aria-hidden className="absolute bottom-0 right-0 h-2/3 w-3/4 rounded-full bg-[#DDF4EE] opacity-60 blur-xl" />
              <HeroPageCard />
              <div className="absolute -top-3 right-0 z-20 rotate-3 rounded-[10px] border border-dashed border-[#D9CDB9] bg-surface px-3.5 py-2.5 shadow-paper sm:-right-3">
                <div className="flex items-center gap-1.5 text-[8.5px] font-extrabold uppercase tracking-[0.14em] text-green"><span className="h-1.5 w-1.5 rounded-full bg-green" aria-hidden />Settled</div>
                <b className="mt-1 block font-display text-[15px] tracking-[-0.02em]">+₦1,500</b>
                <small className="block text-[10px] text-muted">1.00 USDT · BEP20</small>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="Notes from the wall" className="border-y border-line bg-white/40 py-10 sm:py-12">
          <div className={wrap}>
            <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-5">
              <span className={kicker}><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />Notes from the wall</span>
              <span className="text-[12.5px] text-muted">Every treat carries a note. The public ones stay on your page.</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {notes.map((n, i) => <NoteSlip key={n.name} note={n} className={["lg:-rotate-1", "lg:mt-3 lg:rotate-1", "lg:-rotate-[0.8deg]", "lg:mt-2 lg:rotate-1"][i]} />)}
            </div>
          </div>
        </section>

        <section id="how" className="scroll-mt-20 py-16 sm:py-20">
          <div className={wrap}>
            <div className="max-w-[700px]">
              <p className={kicker}><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />One link, three jobs</p>
              <h2 className={`${display} mt-3 text-[clamp(2.1rem,4.2vw,3.5rem)] leading-[0.98]`}>A page that feels like you. A checkout that feels effortless.</h2>
              <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-muted sm:text-[17px]">The best support pages get out of the way. Pick a treat, add a note, pay in seconds. The money side stays clear and calm.</p>
            </div>
            <div className="mt-10 grid border-t border-line md:grid-cols-3">
              {steps.map((s, i) => (
                <div key={s.title} className={`flex flex-col py-7 md:px-7 ${i === 0 ? "md:pl-0" : ""} ${i < 2 ? "md:border-r md:border-line" : ""} ${i > 0 ? "border-t border-line md:border-t-0" : ""}`}>
                  <span className="font-display text-[12px] font-extrabold tracking-[0.1em] text-accent">0{i + 1}</span>
                  <h3 className="mt-3 font-display text-[25px] font-extrabold tracking-[-0.035em]">{s.title}</h3>
                  <p className="mt-2 max-w-[32ch] text-[13.5px] leading-relaxed text-muted">{s.body}</p>
                  <div className="mt-5 flex min-h-[128px] flex-col justify-center rounded-[14px] border border-line bg-surface p-3">
                    <HowArt index={i} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-16 sm:pb-20" aria-label="What you can do">
          <div className={wrap}>
            <div className="grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
              <div className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface p-5 sm:p-6 lg:row-span-2">
                <h3 className="font-display text-[23px] font-extrabold tracking-[-0.03em]">Make it yours in a minute</h3>
                <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">Cover, photo, tagline, accent. The preview updates as you type, so you never guess what supporters will see.</p>
                <div className="mt-5 flex-1"><EditorMock /></div>
              </div>
              <div className="flex flex-col rounded-[20px] border border-line bg-surface p-5">
                <h3 className="font-display text-[23px] font-extrabold tracking-[-0.03em]">A goal people can rally around</h3>
                <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">Set a target for something specific. Supporters see the progress, and every treat moves it forward.</p>
                <div className="mt-5 rounded-xl border border-line bg-canvas p-3.5">
                  <div className="flex justify-between text-[11px] font-bold"><span>New camera</span><span>64%</span></div>
                  <div className="mt-2 h-2 rounded-full bg-surface-2"><div className="h-full w-[64%] rounded-full bg-mint" /></div>
                  <p className="mt-2 text-[10.5px] text-muted">₦64,000 of ₦100,000 · 12 supporters</p>
                  <div className="mt-3 flex -space-x-1.5" aria-hidden>
                    {["AB", "TC", "KD", "+9"].map((f) => <span key={f} className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent/15 text-[8px] font-extrabold text-accent">{f}</span>)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col rounded-[20px] border border-line bg-surface p-5">
                <h3 className="font-display text-[23px] font-extrabold tracking-[-0.03em]">Money that lands clearly</h3>
                <p className="mt-2 max-w-[38ch] text-[13.5px] leading-relaxed text-muted">What they paid, what arrived, what the fee was. The same numbers, before and after.</p>
                <div className="mt-5 grid gap-2 text-[11px] text-muted">
                  {[["Supporter paid", "₦1,500"], ["Platform fee", "− ₦60"], ["You receive", "1.00 USDT"]].map(([k, v], i) => (
                    <div key={k} className={`flex justify-between pb-2 ${i < 2 ? "border-b border-dashed border-line" : ""}`}>
                      <span>{k}</span><b className={i === 2 ? "text-green" : "text-fg"}>{v}</b>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="dashboard" className="relative scroll-mt-20 overflow-hidden border-t border-line bg-surface-2/40 py-16 text-fg sm:py-20">
          <div aria-hidden className="pointer-events-none absolute -bottom-1/2 -left-24 h-[600px] w-[600px] rounded-full" style={{ background: "radial-gradient(circle,rgba(240,103,90,.10),transparent 65%)" }} />
          <div className={`${wrap} relative grid items-center gap-12 lg:grid-cols-[.82fr_1.18fr] lg:gap-[60px]`}>
            <div>
              <p className="inline-flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-accent"><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />The back office</p>
              <h2 className={`${display} mt-3 max-w-[15ch] text-[clamp(2rem,4vw,3.1rem)] leading-[0.98]`}>Money that feels clear, even while you&apos;re creating.</h2>
              <p className="mt-4 max-w-[40ch] text-[15.5px] leading-relaxed text-muted">Your balance, your supporters and your next payout — without crypto jargon getting in the way.</p>
              <ul className="mt-6 grid gap-3.5">
                {[
                  ["One balance, one button.", "Available, received and pending are separated. Withdraw when you want."],
                  ["Fees before you confirm.", "The amount your bank or wallet receives is on screen before the code is sent."],
                  ["A setup list that actually helps.", "Each step links to the thing it asks for, and the page tells you what is missing."],
                ].map(([b, t]) => (
                  <li key={b} className="flex gap-2.5 text-[14px] leading-relaxed text-muted">
                    <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent"><Check size={12} aria-hidden /></span>
                    <span><b className="text-fg">{b}</b> {t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <DashboardMock />
          </div>
        </section>

        <section className="border-y border-line bg-surface-2/60 py-16 sm:py-20">
          <div className={`${wrap} grid gap-8 lg:grid-cols-[.72fr_1.28fr] lg:gap-14`}>
            <div>
              <p className={kicker}><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />The part that lasts</p>
              <h2 className={`${display} mt-3 max-w-[12ch] text-[clamp(2rem,4.2vw,3.5rem)] leading-[0.98]`}>Support that feels personal — because it is.</h2>
              <p className="mt-4 max-w-[40ch] text-[15.5px] leading-relaxed text-muted">Every treat carries a note. The good ones stay on your page, like a guestbook from the people who show up.</p>
            </div>
            <div className="grid gap-7">
              {[
                ["The note is the part people remember.", "It turns a payment into a moment. Public notes stay on your page; private ones still reach you."],
                ["Money should be clear enough to disappear.", "What they paid, what arrived, what the fee was — in plain language, before you confirm."],
              ].map(([line, body], i) => (
                <div key={line} className={`${i === 0 ? "border-b border-line pb-7" : ""}`}>
                  <p className="font-serif text-[clamp(1.5rem,2.5vw,2.1rem)] italic leading-[1.25] tracking-[-0.02em] text-fg">{line}</p>
                  <p className="mt-3 text-[12px] font-semibold leading-relaxed text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 py-16 sm:py-20">
          <div className={`${wrap} grid gap-8 lg:grid-cols-[.8fr_1.2fr] lg:gap-[60px]`}>
            <div>
              <p className={kicker}><span className="h-[7px] w-[7px] rounded-full bg-accent" aria-hidden />Questions</p>
              <h2 className={`${display} mt-3 text-[clamp(2.1rem,4.2vw,3.5rem)] leading-[0.98]`}>The short answers.</h2>
              <p className="mt-4 max-w-[34ch] text-[15.5px] leading-relaxed text-muted">Still curious? The terms and privacy pages have the full details.</p>
            </div>
            <div>
              {faq.map(([q, a], i) => (
                <details key={q} open={i === 0} className="group border-t border-line last:border-b">
                  <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-4 py-5 text-[15px] font-bold [&::-webkit-details-marker]:hidden">
                    <span className="font-display text-[11px] font-extrabold tracking-[0.06em] text-accent">0{i + 1}</span>
                    {q}
                    <span className="text-[22px] font-light leading-none text-fg transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
                  </summary>
                  <p className="mb-5 ml-[42px] max-w-[56ch] text-[13.5px] leading-relaxed text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-accent py-16 text-on-accent sm:py-20">
          <div aria-hidden className="absolute inset-x-0 top-0 h-3" style={{ background: "repeating-linear-gradient(90deg,transparent 0 12px,rgba(43,13,9,.14) 12px 14px)" }} />
          <div className={`${wrap} relative grid items-center gap-8 lg:grid-cols-[1.08fr_.92fr] lg:gap-11`}>
            <div>
              <p className="text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#5A231B]">Start in under a minute</p>
              <h2 className={`${display} mt-3 max-w-[15ch] text-[clamp(2.2rem,4.8vw,4rem)] leading-[0.98]`}>Your people are already cheering. Give them a way to say it.</h2>
              <p className="mt-4 max-w-[40ch] text-[16px] leading-relaxed text-[#5A231B]">One link. Local treats. Real support. Set up your page in under a minute.</p>
              <Link href="/signup" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full bg-fg px-5 py-3 text-[15px] font-bold text-canvas shadow-[0_18px_40px_-20px_rgba(43,13,9,.6)] transition-[filter,transform] hover:brightness-110 active:translate-y-px">Start my page — it&apos;s free <ArrowRight size={16} aria-hidden /></Link>
              <p className="mt-3.5 text-[11.5px] text-[#5A231B]">No monthly fee · Withdraw anytime</p>
            </div>
            <div className="relative hidden h-[300px] w-full max-w-[520px] justify-self-end lg:block" aria-hidden>
              {[
                { img: "/treats/zobo.webp", name: "Zobo", price: "₦500", pos: "left-[2%] top-0 -rotate-[5deg]" },
                { img: "/treats/suya.webp", name: "Suya", price: "₦800", pos: "left-[28%] top-[92px] rotate-3" },
                { img: "/treats/jollof.webp", name: "Jollof", price: "₦500", pos: "left-[10%] top-[182px] -rotate-2" },
              ].map((t) => (
                <div key={t.name} className={`absolute flex w-[248px] items-center gap-3 rounded-xl bg-surface p-3 pr-[18px] shadow-[0_26px_54px_-30px_rgba(43,13,9,.65)] ${t.pos}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.img} alt="" className="h-[58px] w-[58px] rounded-full object-cover" />
                  <div><b className="block font-display text-[19px] tracking-[-0.025em] text-fg">{t.name}</b><small className="block text-[12.5px] text-muted">{t.price}</small></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${wrap} grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_.7fr_.7fr] lg:gap-10`}>
          <div>
            <Logo />
            <p className="mt-3 max-w-[30ch] text-[13px] leading-relaxed text-muted">Small treats, real support. One link for the people who show up.</p>
          </div>
          <div className="text-[13px]">
            <b className="mb-3 block text-[11px] uppercase tracking-[0.1em] text-fg">Product</b>
            <Link href="/#how" className="mb-2 block text-muted hover:text-fg">How it works</Link>
            <Link href="/@hello" className="mb-2 block text-muted hover:text-fg">Example page</Link>
            <Link href="/#dashboard" className="mb-2 block text-muted hover:text-fg">For creators</Link>
            <Link href="/docs" className="mb-2 block text-muted hover:text-fg">Developers</Link>
          </div>
          <div className="text-[13px]">
            <b className="mb-3 block text-[11px] uppercase tracking-[0.1em] text-fg">Company</b>
            <Link href="/#faq" className="mb-2 block text-muted hover:text-fg">Questions</Link>
            <Link href="/legal#terms" className="mb-2 block text-muted hover:text-fg">Terms</Link>
            <Link href="/legal#privacy" className="mb-2 block text-muted hover:text-fg">Privacy</Link>
            <a href="mailto:hello@show-me-love.com" className="mb-2 block text-muted hover:text-fg">Contact</a>
          </div>
        </div>
        <div className={`${wrap} flex flex-wrap justify-between gap-3 border-t border-line py-5 text-[11.5px] text-muted`}>
          <span>© show-me-love {new Date().getFullYear()}</span>
          <span>Built in Lagos · Small treats, real support.</span>
        </div>
      </footer>
    </div>
  );
}
