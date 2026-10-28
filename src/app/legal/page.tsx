import type { Metadata } from "next";

import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Terms and Privacy · show-me-love" };

export default function Legal() {
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="border-b border-line px-5 py-3"><Logo /></header>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-warn text-sm font-semibold">
          Draft: this page is plain-language placeholder text and has not been reviewed by a lawyer. It must be reviewed before launch.
        </p>

        <h1 id="terms" className="mt-8 scroll-mt-6 font-display text-4xl font-semibold tracking-tight">Terms</h1>
        <div className="mt-3 space-y-3">
          <p>show-me-love lets creators share a page where fans can send small treats of support, paid by card or bank transfer and credited to the creator in USDT.</p>
          <p><strong>Your account.</strong> You must be old enough to enter a contract where you live, give true details, and keep your login safe. You are responsible for what happens on your page.</p>
          <p><strong>Supporting a creator.</strong> A treat is a voluntary gift, not a purchase of goods or a refundable deposit. Refunds are at our discretion, for example for duplicate or mistaken payments.</p>
          <p><strong>Fees and payouts.</strong> We keep a platform fee from each treat and charge a small fee per payout. New accounts may have a 24 hour review before a first withdrawal, and daily withdrawal limits apply. Fees and limits are shown in the app.</p>
          <p><strong>Not allowed.</strong> Fraud, money laundering, illegal or harmful content, impersonation, or using the service to harass people. We may remove content, hold payouts under review, or close accounts that break these rules.</p>
          <p><strong>Developers.</strong> Apps using Connect must keep API keys secret, only link users who agreed, and stop using a creator&apos;s data when they disconnect or revoke.</p>
          <p><strong>Our promise, and its limits.</strong> We work to keep the service running, but it is provided as is. To the extent the law allows, we are not liable for indirect losses.</p>
        </div>

        <h1 id="privacy" className="mt-12 scroll-mt-6 font-display text-4xl font-semibold tracking-tight">Privacy</h1>
        <div className="mt-3 space-y-3">
          <p><strong>What we collect.</strong> Your email, username and profile, the payments made to and by you (including the name or message a supporter chooses to add), payout details, and basic technical data needed to keep the service safe.</p>
          <p><strong>How we use it.</strong> To run your account, process payments and payouts, prevent fraud, send service emails, and answer reports. We do not sell personal data.</p>
          <p><strong>Who sees it.</strong> Your public page shows what you choose to publish. Supporters&apos; names appear in the notes from supporters only if they choose to. Payment and email providers process data for us. Apps you allow through Connect see your support link, and your totals only if you tick that option. You can revoke an app at any time from the Share page.</p>
          <p><strong>Keeping and deleting.</strong> We keep payment records as long as financial rules require. Ask us to close your account and delete what we are not required to keep.</p>
          <p><strong>Your choices.</strong> You can ask for a copy of your data or a correction by contacting us through the app.</p>
        </div>
      </main>
    </div>
  );
}
