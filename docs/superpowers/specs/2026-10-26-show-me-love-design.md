# show-me-love — Design Spec

Date: 2026-10-26
Status: approved in brainstorming, awaiting written-spec review

## 1. Intent

show-me-love is a feature-for-feature clone of buymeamalt.com (a Nigerian "Buy Me a Coffee"), with the fiat payment rail replaced by the Roqqu API Service (RAS).

- **Purpose:** entry for the Anambra Web3 Hackathon (Roqqu); demo on **2026-11-07**. It must also be a real, live product: real creators, real payments.
- **Success:** every buymeamalt surface (landing, onboarding, dashboard pages, public page, goals, group support, share, developers/Connect, withdrawals) works end to end on Vercel, with payments settled through RAS. RAS test mode for the demo; switching to live is an env change only.
- **Brand:** own name, logo, palette and treat art. buymeamalt's structure and flows are copied; its logo, copy and product photos are not.

### What was observed (reverse engineering)

From the user's screenshots, the public site, `/api/treat-catalog`, and a read-only pass over the user's logged-in dashboard:

- Stack: Next.js (Turbopack), better-auth (`/api/auth/get-session`), `/api/onboarding`, `/api/usernames?username=`, `/api/treat-catalog`.
- Treat catalog items: `{id, name, aliases[], emoji, image, active, category: treat|malt|alcohol, sort_order}`. Malt and Trophy expand into brand sub-lists.
- Dashboard: Overview, Your page, Treats, Support a group (`/dashboard/group`), Goals, Withdrawals, Share (`?tab=social|website|livestream|apps`), Developers.
- Support a group: 2–10 creator usernames, NGN or USD for the whole group, split settings, confirm, one private checkout; History tab.
- Developers: Live/Sandbox apps, API keys, OAuth-style "Connect" so third-party apps get a creator's `support_url` and (with consent) earnings; SDK, hosted HTTP API, integration guide with Manual / AI-prompt modes, starter app.
- Withdrawals: bank account, ₦50 payout fee, "Awaiting Review" for new accounts in their first day.

### RAS constraints that shape the design

- Base URL `https://service.roqqu.com/v1`; header `x-staging-api-key` (test) or `x-api-key` (live). Bodies are form-encoded; objects are sent as JSON strings.
- Payment links accept USDT on BEP20 or TRC20, and BTC. Webhook events: `payment_link_completed`, `payment_link_completed_overpaid`, `payment_link_failed`.
- Webhook body is `{hash}`, AES-256-CTR, key = first 32 chars of the API key, IV = hex of the `x-api-key` request header.
- `Send Coin` sends crypto out. `/rates` gives fiat rates. There is **no bank / NGN payout endpoint**.

## 2. Decisions

| Topic | Decision |
|---|---|
| Pricing and settlement | Priced in ₦, converted at a locked `/rates` rate, settled in USDT via a RAS payment link |
| Withdrawals | USDT via `Send Coin` to the creator's address, **or** NGN bank payout that an admin cashes out by hand through Roqqu and marks paid |
| Scope | Full parity, delivered in three tiers, all before Nov 7 |
| Developers | Full Connect (apps, keys, consent, connect/callback/disconnect, earnings with consent, Connected apps, docs, starter). No npm package |
| Architecture | One standalone Next.js app; RAS client, webhook decrypt and ledger copied from Roqqu Studio |
| Sign-in | Email + password, plus emailed magic link. No Google OAuth |
| Admin | `/admin` for role `admin`: withdrawal review, NGN payouts, refunds, reports |

## 3. Architecture

Folder `Desktop/Claude response/show-me-love`, repo `Obiajulu-gif/show-me-love`, one Vercel project, Neon Postgres.

Stack: Next.js 15 App Router, TypeScript, `postgres` (raw SQL) with numbered SQL migrations, `jose` cookie sessions, Tailwind, `lucide-react`, `qrcode.react`, Vercel Blob for uploads, Resend for email, Vitest, PGlite for local dev and integration tests, Playwright for the smoke script.

### Routes

- `/` landing
- `/@[username]` public page; `/@[username]/thanks` post-payment; `/@[username]/goals/[slug]` goal page
- `/login`, `/signup`, `/onboarding`
- `/dashboard` (overview), `/dashboard/your-page`, `/dashboard/treats`, `/dashboard/group`, `/dashboard/goals`, `/dashboard/withdrawals`, `/dashboard/share`, `/dashboard/developers`
- `/admin`, `/admin/withdrawals`, `/admin/payments`, `/admin/reports`
- `/connect/authorize` consent screen
- `/docs` public developer docs; `/legal` terms and privacy
- API: `/api/auth/*`, `/api/usernames`, `/api/treat-catalog`, `/api/uploads`, `/api/checkout`, `/api/payments/[ref]`, `/api/ras/webhook`, `/api/withdrawals/*`, `/api/cron/expire`, `/api/connect/{sessions,token,connection,earnings,disconnect}`

### Library modules

- `lib/ras.ts` — RAS client (copied, trimmed)
- `lib/webhook-crypto.ts` — AES-256-CTR decrypt (copied)
- `lib/ledger.ts` — append-only ledger and balance (copied, adapted)
- `lib/db.ts`, `lib/session.ts`, `lib/email.ts`, `lib/ratelimit.ts`
- `lib/rates.ts` — ₦→USDT using RAS `/rates`, cached 60 s, stale fallback up to 10 min
- `lib/money.ts` — conversion, rounding, fees, group split
- `lib/connect.ts` — codes, redirect matching, key hashing

## 4. Data model

All money columns are `numeric`. USDT amounts use 6 decimal places internally and display 2.

- `users(id, email citext unique, password_hash, role creator|admin, created_at)`
- `creators(user_id pk, username citext unique, display_name, bio, photo_url, birthday date, birthday_mode, socials jsonb, treat_id, custom_treat jsonb, unit_price_ngn, presets int[], thank_you_text, page_style jsonb, share_message, payout_address, payout_network bep20|trc20, bank jsonb, created_at)`
- `username_history(old_username citext pk, user_id)` — old usernames redirect
- `treat_catalog(id, name, aliases text[], emoji, image, active, category, parent_id, sort_order)`
- `payments(id, ref unique, kind treat|goal|group, creator_id, goal_id, group_id, supporter_name, supporter_email, message, is_public, quantity, amount_ngn, amount_usdt, rate, link_url, network, status pending|successful|expired|failed|refunded, failure_reason, created_at, completed_at)`
- `group_payments(id, payer_user_id, currency, split_mode even|custom, payment_id, created_at)` and `group_splits(group_id, creator_id, share_amount)`
- `goals(id, creator_id, slug, title, story, cover_url, currency, target, suggested, show_progress, show_target, organizer_name, organizer_photo, header_mode default|logo|hidden, paused, currency_locked, created_at)`
- `ledger_entries(id, creator_id, kind credit|fee|hold|release|reversal|payout, amount_usdt signed, ref unique, created_at)` — balance is `SUM(amount_usdt)` per creator; never stored
- `withdrawals(id, creator_id, method usdt|ngn_bank, amount_usdt, fee_usdt, amount_ngn, destination jsonb, status awaiting_review|processing|paid|rejected|failed, ras_reference, bank_reference, admin_note, created_at, updated_at)`
- `one_time_codes(id, user_id, purpose login|withdrawal, code_hash, expires_at, used_at)`
- `apps(id, owner_id, name, mode sandbox|live, redirect_uris text[], client_id unique)`, `api_keys(id, app_id, prefix, last4, key_hash, revoked_at)`, `auth_codes(code_hash, app_id, user_id, user_ref, earnings_shared, state, expires_at, used_at)`, `connections(app_id, user_ref, user_id, earnings_shared, created_at, revoked_at, unique(app_id, user_ref))`
- `reports(id, username, reason, details, reporter_email, created_at, resolved_at)`
- `rate_limits(key, window_start, count)`

## 5. Payment flows

### Treat checkout

1. Supporter picks a quantity (1/3/5 presets, stepper) or "Choose an amount", and adds name, message and public/private.
2. Server computes `amount_ngn = qty × unit_price_ngn`, reads the rate, sets `amount_usdt = ceil2(amount_ngn / rate)`, inserts a pending `payments` row, then calls `POST /payment-links` with a 20-character alphanumeric reference, `customer_details` (email, first and last name), and `success_url = https://<host>/@username/thanks?ref=…`.
3. Supporter is redirected to the RAS hosted link and pays USDT on BEP20 or TRC20. The link is created with `wallets` limited to those two networks, so BTC is never offered and every credit is in USDT.
4. Webhook: decrypt, look up the payment by reference.
   - `completed` or `completed_overpaid` → `successful`; ledger `credit` of the received USDT, then a `fee` debit of `PLATFORM_FEE_BPS`. Overpay is credited the actual amount and flagged.
   - `failed` (including underpaid) → `failed`.
5. Thanks page polls `/api/payments/[ref]` until the status is final.
6. No webhook within 60 minutes → RAS requery; if still unpaid → `expired`. Runs lazily on read and from a Vercel cron every 15 minutes.

### Goal checkout

Same as a treat, with `kind=goal`. Currency locks when the first checkout starts. A paused goal refuses new checkouts; payments already in progress may still arrive. Progress is the sum of successful payments before fees.

### Group checkout

2–10 usernames, each validated and confirmed. The payer picks NGN or USD for the whole group; both convert to USDT at checkout (USD 1:1). Split is even or custom per creator. One RAS link for the total. On success, one `credit` per creator by share; the rounding remainder goes to the first creator; each creator then pays its own fee. Shows on the payer's History tab and on each creator's treats list as "via group".

### Refunds

Admin triggers RAS `Refund Transaction` on a successful payment → `reversal` ledger entries and status `refunded`.

### Fees

- `PLATFORM_FEE_BPS`, default 500 (5%).
- USDT withdrawal: live RAS network fee (`Get Network Fees`).
- NGN bank withdrawal: flat ₦50 equivalent (`NGN_PAYOUT_FEE`).

### Withdrawals

- Each request needs an emailed 6-digit code and is limited by a daily cap (`DAILY_WITHDRAW_USD`).
- Creating a request writes a `hold` ledger entry.
- **USDT:** accounts younger than 24 hours → `awaiting_review`; otherwise → `processing` and `Send Coin` is called at once. The coin webhook or a requery by reference sets `paid` (a `hold` becomes a `payout`). On failure, a `release` entry restores the balance.
- **NGN bank:** always `awaiting_review`. Admin cashes out through Roqqu by hand, enters the bank reference and marks it `paid`, or rejects it (`release`).

### Balance display

USDT is the source of truth. A ₦ equivalent at the current rate is shown alongside it.

## 6. Screens

Design system: cream background, cocoa text, honey-yellow primary buttons with a hard bottom shadow, 16–20 px card radius, serif italic for taglines, sans-serif for UI, own heart-cup logo, Lucide icons.

- **Landing:** hero; treat picker grid (Malt and Trophy expand to brand sub-lists; Custom takes a name plus an emoji or image); live username check; "Claim my page" → signup → onboarding, prefilled. Then 3 feature cards, a sample creator page, FAQ, final call to action, footer.
- **Dashboard shell:** sidebar (Overview, Your page, Treats, Support a group, Goals, Withdrawals, Share; View your page; Developers; Sign out). Collapsible; a drawer on mobile.
- **Overview:** total received, available balance, treat count; page setup checklist (create page, photo and bio, birthday); recent treats table with "View all".
- **Your page:** tabs Basics / Treats / Page style; floating Prev / Next / Save bar; live Mobile/Desktop preview with expand and "View live page".
- **Treats:** status filter (Successful, Pending, Expired, Failed/cancelled, Refunded, All), count, empty states.
- **Support a group:** Add support and History tabs.
- **Goals:** list plus create/edit drawer (title, story, cover, currency, target, suggested contribution, show progress, show target, organizer name and photo, goal header, info note, Cancel / Save). Pause, edit, copy link, progress bar.
- **Withdrawals:** available card with refresh; payout destination card with Change; history table; Make a withdrawal modal (source, amount, Use full balance, fee line, destination receives, code step).
- **Share:** Social & links (link + copy, editable share message, Share to X, WhatsApp); Website (button preview "Matches your page", Copy HTML embed); QR Code (branded card or compact QR, PNG download, OBS note); Connected apps (list, revoke).
- **Developers:** Live/Sandbox toggle, app list, create app, generate or revoke key (shown once), starter config, integration guide drawer with Manual and AI-prompt tabs.
- **Public page:** banner tagline and avatar, name, handle, thank-you line; wall of encouragement; buy card; Wall of love (12-week UTC heatmap, tooltips, Less/More legend); footer with Terms, Privacy, Report page. Unknown username → "unclaimed" 404.
- **Admin:** withdrawal queue (approve → Send Coin, mark NGN paid, reject), payment search with refund, reports.

## 7. Developers / Connect

1. App backend calls `POST /api/connect/sessions` with `client_id`, API key and `user_ref` → `authorize_url`.
2. Creator opens `/connect/authorize`, signs in if needed, sees the app name and scopes (support link always; earnings optional checkbox), then Allow or Deny.
3. Allow → redirect to the exact registered `redirect_uri` with a one-time `code` (10-minute expiry) and `state`. Deny → `error=access_denied`.
4. App backend calls `POST /api/connect/token` with the code and API key → `connections` row keyed by (app, user_ref). The app stores no token.
5. `GET /api/connect/connection?user_ref=` → `{username, display_name, support_url, earnings_shared}`. `GET /api/connect/earnings?user_ref=` → 403 unless earnings are shared.
6. `POST /api/connect/disconnect`, or revoke from Share → Connected apps. After that, reads return 404.

Sandbox and Live use separate apps and keys (`sml_test_` / `sml_live_`). Sandbox earnings are fake and never read real balances.

Docs: `/docs` (overview, quickstart, HTTP API reference, security checklist), a Next.js snippet, `examples/connect-starter` in the repo, and an AI-prompt tab.

## 8. Security

- Passwords: Node `crypto.scrypt`. Sessions: HttpOnly, SameSite=Lax JWT cookies signed with `jose`.
- Magic links and one-time codes: single use, short expiry, stored as hashes.
- API keys: sha256 at rest; the UI shows prefix and last 4 only.
- `redirect_uri` exact match; `state` passed through unchanged.
- Rate limits (Postgres counter) on login, username check, checkout creation, code requests and connect endpoints.
- Webhook: reject anything that fails to decrypt or parse; idempotent through the unique ledger `ref`; amount always checked against the `payments` row.
- Uploads: PNG/JPEG/WebP only; 10 MB avatars, 5 MB covers.
- Every query scoped by creator; admin routes check the role on the server.
- Secrets live only in Vercel env, entered by the user.

## 9. Error handling

- RAS down or `fail` on link creation → payment `failed` with the reason; supporter sees "Checkout is busy, try again". Nothing is credited.
- Rate fetch fails → last cached rate if under 10 minutes old, else checkout is blocked.
- Webhook with an unknown reference → logged, answered 200.
- `Send Coin` failure → `release`, status `failed` with the reason, admin emailed.
- Ledger writes run in one transaction with the status change, using `SELECT … FOR UPDATE` on the payment or withdrawal row.
- Every list has loading, empty and error states.

## 10. Testing

- **Unit (Vitest):** ₦→USDT rounding, fee math, group split remainder, ledger balance, webhook decrypt with the RAS docs fixture, username rules, heatmap bucketing, `redirect_uri` matching, code expiry.
- **Integration (PGlite):** checkout → webhook → credit → balance; duplicate webhook ignored; withdrawal hold → send or reject; group split credits; Connect code → connection; earnings 403 without consent.
- **Smoke (Playwright):** claim → edit → public page → checkout → replayed webhook → treat appears → withdrawal → admin approve.
- **Live check before the demo:** one real RAS test-mode payment link created and paid.

## 11. Delivery

| Tier | Dates | Scope |
|---|---|---|
| T1 | Oct 27–31 | Landing, auth, onboarding, Your page and preview, public page, treat checkout, webhook and ledger, Overview, Treats, Withdrawals (USDT and NGN), admin queue |
| T2 | Nov 1–3 | Goals (drawer and goal page), Share (all 4 tabs; Connected apps empty until T3), Wall of love, Report page, refunds |
| T3 | Nov 4–6 | Support a group, Developers/Connect, docs, starter |
| Buffer | Nov 6–7 | Polish, demo seed data |

Each tier is deployed and passes its tests before the next starts.

### Environment

User-entered secrets: `DATABASE_URL`, `SESSION_SECRET`, `RAS_API_KEY`, `RESEND_API_KEY`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`.
Non-secret: `RAS_MODE=test|live`, `PUBLIC_APP_URL`, `PLATFORM_FEE_BPS`, `NGN_PAYOUT_FEE`, `DAILY_WITHDRAW_USD`, `ADMIN_EMAILS`.

After deploy, the user registers `https://<host>/api/ras/webhook` in the RAS dashboard.

## 12. Out of scope

- Publishing an npm SDK.
- Google or other social sign-in.
- Automated NGN bank payouts (RAS has no endpoint for them).
- Copying buymeamalt's logo, copy or product photos.
