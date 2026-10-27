import { Banknote, Coins, Sprout } from "lucide-react";
import Link from "next/link";

import { ClaimCard } from "@/components/ClaimCard";
import { CreatorPage } from "@/components/CreatorPage";
import { Logo } from "@/components/Logo";
import { buttonClass } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const features = [
  { Icon: Sprout, title: "Treats people know", body: "Zobo, suya, jollof, malt. Supporters pick a treat they recognise, priced in naira, instead of a vague tip." },
  { Icon: Coins, title: "Paid in USDT", body: "Each treat is a Roqqu payment link. Supporters pay in USDT on BEP20 or TRC20 and you are credited what arrives." },
  { Icon: Banknote, title: "Withdraw your way", body: "Take your balance as USDT to your own wallet, or cash out to a Nigerian bank account." },
];

const faq = [
  ["How do supporters pay?", "They choose a treat and a quantity. We make a Roqqu payment link for the naira total, and they pay the equivalent in USDT."],
  ["What does it cost?", "A small platform fee is taken from each treat, and bank withdrawals carry a flat payout fee. Both show before you confirm anything."],
  ["How do I get my money?", "Withdraw as USDT to a BEP20 or TRC20 wallet, or to a Nigerian bank account. New accounts get a short review window on the first withdrawals."],
  ["Can I raise money for something specific?", "Yes. Set a goal with a target and a story, and supporters can see progress. You can also accept support as a group."],
  ["Can I connect it to my own app?", "Yes. The developer Connect API lets your app read supporters and treats with your permission."],
] as const;

const demo = {
  username: "ada_bakes", displayName: "Ada Bakes", bio: "Baking tutorials every Friday. Fuel me with zobo.", photoUrl: null,
  treatName: "Zobo", treatImage: "/treats/zobo.svg", unitPriceNgn: 500, presets: [1, 3, 5], thankYouText: "", tagline: "A little love. A lot of possibility.",
  accent: "honey", header: "default", coverUrl: null, socials: [],
};
const demoWall = [{ id: "d1", name: "Tunde", quantity: 3, message: "Your sourdough saved my weekend.", at: new Date(0) }, { id: "d2", name: "Ife", quantity: 1, message: "Keep going!", at: new Date(0) }];

export default function Home() {
  return (
    <div className="min-h-screen bg-cream text-cocoa">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="hover:underline">Log in</Link>
          <Link href="/signup" className={buttonClass("primary", "py-1.5")}>Sign up</Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2">
          <div>
            <h1 className="font-serif text-5xl italic leading-tight sm:text-6xl">
              Make it easy for your people<br /><span className="text-cocoa-2">to show you love.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg">One link. Local treats like zobo and suya. Paid in USDT, withdrawn to your wallet or bank.</p>
            <div className="mt-8 flex h-56 w-56 items-center justify-center rounded-full bg-honey">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/treats/zobo.svg" alt="A glass of zobo" className="h-32 w-32" />
            </div>
          </div>
          <div className="lg:justify-self-end"><ClaimCard /></div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-8 md:grid-cols-3">
          {features.map(({ Icon, title, body }) => (
            <Card key={title}>
              <Icon className="text-cocoa-2" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-cocoa-2">{body}</p>
            </Card>
          ))}
        </section>

        <section className="mx-auto grid max-w-6xl items-center gap-8 px-5 py-10 md:grid-cols-2">
          <div>
            <h2 className="font-serif text-3xl italic">Your page, ready to share</h2>
            <p className="mt-3 text-cocoa-2">Pick your treat, set a price, and drop one link in your bio. Supporters leave a note with every treat and it lands on your wall of love.</p>
          </div>
          <div className="mx-auto w-full max-w-sm"><CreatorPage creator={demo} mode="preview" payments={demoWall} /></div>
        </section>

        <section className="mx-auto max-w-3xl px-5 py-10">
          <h2 className="font-serif text-3xl italic">Questions</h2>
          <div className="mt-4 space-y-2">
            {faq.map(([q, a]) => (
              <details key={q} className="rounded-[18px] border border-line bg-cream-2 px-5 py-3">
                <summary className="cursor-pointer font-semibold">{q}</summary>
                <p className="mt-2 text-sm text-cocoa-2">{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10">
          <div className="rounded-[18px] bg-cocoa px-6 py-10 text-center text-cream">
            <h2 className="font-serif text-3xl italic">Your people are already cheering. Give them a way to say it.</h2>
            <Link href="/signup" className={buttonClass("primary", "mt-6")}>Create my page</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line py-8 text-center text-sm text-cocoa-2">
        <Logo />
        <p className="mt-2">Small treats, real support.</p>
      </footer>
    </div>
  );
}
