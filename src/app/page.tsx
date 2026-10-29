import { Banknote, Code2, Coins, Goal, Sprout, Users } from "lucide-react";
import Link from "next/link";

import { ClaimCard } from "@/components/ClaimCard";
import { CreatorPage } from "@/components/CreatorPage";
import { LiveLedger } from "@/components/LiveLedger";
import { Logo } from "@/components/Logo";
import { SiteHeader } from "@/components/SiteHeader";
import { buttonClass } from "@/components/ui/Button";

const steps = [
  { title: "Pick a treat", body: "Zobo, suya, jollof or your own. Set a price in naira that feels right." },
  { title: "Share one link", body: "Put show-me-love/@you in your bio, your stream or your website." },
  { title: "Get paid in USDT", body: "Supporters pay through Roqqu. What arrives lands in your balance, ready to withdraw." },
];

const features = [
  { Icon: Sprout, title: "Treats people know", body: "Supporters pick something they recognise instead of a vague tip." },
  { Icon: Coins, title: "Settled in USDT", body: "Paid on BEP20 or TRC20 through Roqqu, credited at what actually arrives." },
  { Icon: Banknote, title: "Withdraw your way", body: "To your own USDT wallet, or to a Nigerian bank account." },
  { Icon: Goal, title: "Goals", body: "Raise towards something specific and show supporters the progress." },
  { Icon: Users, title: "Group support", body: "One payment split across up to ten creators at once." },
  { Icon: Code2, title: "Developer API", body: "Let your own app show your support link and earnings, with your permission." },
];

const faq = [
  ["How do supporters pay?", "They choose a treat and a quantity. We make a Roqqu payment link for the naira total, and they pay the equivalent in USDT."],
  ["What does it cost?", "A small platform fee is taken from each treat, and bank withdrawals carry a flat payout fee. Both show before you confirm anything."],
  ["How do I get my money?", "Withdraw as USDT to a BEP20 or TRC20 wallet, or to a Nigerian bank account. New accounts get a short review window on the first withdrawals."],
  ["Can I raise money for something specific?", "Yes. Set a goal with a target and a story, and supporters can see progress. You can also accept support as a group."],
  ["Can I connect it to my own app?", "Yes. The developer Connect API lets your app read your support link and earnings with your permission."],
] as const;

const demo = {
  username: "ada_bakes", displayName: "Ada Bakes", bio: "Baking tutorials every Friday. Fuel me with zobo.", photoUrl: null,
  treatName: "Zobo", treatImage: "/treats/zobo.webp", unitPriceNgn: 500, presets: [1, 3, 5], thankYouText: "", tagline: "A little love. A lot of possibility.",
  accent: "honey", header: "default", coverUrl: null, socials: [],
};
const demoWall = [{ id: "d1", name: "Tunde", quantity: 3, message: "Your sourdough saved my weekend.", at: new Date(0) }, { id: "d2", name: "Ife", quantity: 1, message: "Keep going!", at: new Date(0) }];

const section = "mx-auto max-w-6xl px-5";

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <SiteHeader />

      <main>
        <section className={`${section} grid items-center gap-12 pb-16 pt-12 lg:grid-cols-[1.1fr_1fr] lg:pt-20`}>
          <div>
            <h1 className="font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Make it easy for your people<br /><span className="text-muted">to show you love.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg text-muted">One link. Local treats like zobo and suya. Paid in USDT, withdrawn to your wallet or bank.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={buttonClass("primary", "px-6 py-3 text-base")}>Create my page</Link>
              <a href="#demo" className={buttonClass("ghost", "px-6 py-3 text-base")}>See a creator page</a>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2 text-sm text-muted">
              {["Free to start", "USDT on BEP20 or TRC20", "Withdraw to bank or wallet"].map((t) => (
                <li key={t} className="rounded-full border border-line px-3 py-1">{t}</li>
              ))}
            </ul>
          </div>
          <LiveLedger />
        </section>

        <section id="how" className="border-y border-line/60 bg-surface/40">
          <div className={`${section} py-16`}>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Live in three steps</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="relative rounded-2xl border border-line bg-canvas/60 p-6">
                  <span className="data flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">{i + 1}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-1 text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className={`${section} grid items-center gap-12 py-20 lg:grid-cols-2`}>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">Start in under a minute</h2>
            <p className="mt-3 max-w-md text-muted">Choose the treat people will send you and claim your link. You can change both later.</p>
          </div>
          <div className="lg:justify-self-end"><ClaimCard /></div>
        </section>

        <section id="demo" className={`${section} grid items-center gap-12 py-16 lg:grid-cols-2`}>
          <div className="mx-auto w-full max-w-sm lg:order-2"><CreatorPage creator={demo} mode="preview" payments={demoWall} /></div>
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">A page your supporters understand</h2>
            <p className="mt-3 max-w-md text-muted">Your treat, your price and notes from the people who back you. Every treat comes with a note, and the public ones show on your page.</p>
          </div>
        </section>

        <section className="border-y border-line/60 bg-surface/40">
          <div className={`${section} py-16`}>
            <h2 className="font-display text-3xl font-semibold tracking-tight">Everything a creator needs</h2>
            <ul className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {features.map(({ Icon, title, body }) => (
                <li key={title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-canvas text-accent"><Icon size={20} aria-hidden /></span>
                  <div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-muted">{body}</p></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className={`${section} grid gap-10 py-20 lg:grid-cols-[1fr_2fr]`}>
          <h2 className="font-display text-3xl font-semibold tracking-tight">Questions</h2>
          <div className="space-y-2">
            {faq.map(([q, a]) => (
              <details key={q} className="group rounded-2xl border border-line bg-surface/60 px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                  {q}<span className="text-muted transition-transform duration-200 group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-2 text-sm text-muted">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={`${section} pb-20`}>
          <div className="rounded-3xl border border-accent/40 bg-surface px-6 py-14 text-center shadow-lift">
            <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold tracking-tight sm:text-4xl">Your people are already cheering. Give them a way to say it.</h2>
            <Link href="/signup" className={buttonClass("primary", "mt-8 px-6 py-3 text-base")}>Create my page</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${section} flex flex-col items-center justify-between gap-4 py-8 text-sm text-muted sm:flex-row`}>
          <div className="flex items-center gap-3"><Logo /><span>Small treats, real support.</span></div>
          <nav className="flex gap-5"><Link href="/docs" className="hover:text-fg">Developers</Link><Link href="/legal#terms" className="hover:text-fg">Terms</Link><Link href="/legal#privacy" className="hover:text-fg">Privacy</Link></nav>
        </div>
      </footer>
    </div>
  );
}
