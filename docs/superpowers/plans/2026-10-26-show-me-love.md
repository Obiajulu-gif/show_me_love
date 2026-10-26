# show-me-love Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build show-me-love, a feature-parity clone of buymeamalt.com where supporters pay creators through Roqqu API Service (RAS) payment links. Treats are priced in ₦ and settled in USDT. Creators withdraw as USDT or as an admin-handled NGN bank payout.

**Architecture:** One Next.js 15 App Router app on Vercel with Neon Postgres, accessed through raw SQL (`postgres`). Proven modules are copied from Roqqu Studio: the RAS client, webhook AES-CTR crypto, password hashing, email, the DB handle and the PGlite test harness. Money lives in an append-only `ledger_entries` table. Only the RAS webhook credits creators.

**Tech Stack:** Next.js 15.5, React 19, TypeScript, Tailwind 3, `postgres`, `jose`, `lucide-react`, `qrcode.react`, `@vercel/blob`, Vitest, `@electric-sql/pglite` + `@electric-sql/pglite-socket` (tests and local dev), Playwright (smoke script only).

**Spec:** `docs/superpowers/specs/2026-10-26-show-me-love-design.md`

**Source of copied modules:** `C:\Users\googl\Desktop\Claude response\monnify-studio\apps\web` (called "Roqqu Studio" below). Copy files and then edit them; do not import across repos.

## Global Constraints

- Node 22+. `next@15.5.x`, `react@19`. No dependencies beyond the Tech Stack list.
- Brand: product name `show-me-love`, footer tagline "A little love goes a long way." Never use buymeamalt's logo, copy, or product photos. Treat art: emoji + our own illustrations in `public/treats/`.
- Theme tokens (Tailwind `theme.extend.colors`): `cream #FFF9EE`, `cream-2 #F6EEDF`, `cocoa #3B2416`, `cocoa-2 #7A4A2E`, `honey #F6C55A`, `honey-ink #2B1A0E`, `line #EADCC6`. Card radius `rounded-[18px]`. Primary button is honey with `shadow-[0_4px_0_#3B2416]`.
- Public creator URL is `/@username`. A Next.js folder starting with `@` is a parallel-route slot, so `middleware.ts` rewrites `/@:username(/...)` to `/u/:username(/...)`.
- Usernames: `^[a-z0-9_]{3,24}$`, case-insensitive (`citext`).
- Money: `numeric` in SQL; USDT is computed at 6 decimals and shown at 2. `PLATFORM_FEE_BPS` defaults to `500`. `NGN_PAYOUT_FEE` defaults to `50`. `DAILY_WITHDRAW_USD` defaults to `500`. New-account review window: 24 h. Pending payment expiry: 60 min. Stale-rate fallback: 10 min. Rate cache: 60 s.
- RAS env (deviation from spec §11, kept from Roqqu Studio because its client is proven):
  - `RAS_MODE=practice|test|live`.
  - Keys: `RAS_TEST_KEY` (sent as `x-staging-api-key`) and `RAS_LIVE_KEY` (sent as `x-api-key`).
  - `ALLOW_PRODUCTION_EXECUTION=true` is required for live.
  - `practice` simulates every call and is used by tests and local dev.
- Payment-link wallets are limited to `bep20` and `trc20` USDT. The link amount is sent in NGN (`amount_currency: "ngn"`, as Roqqu Studio does). Credits always use the USDT amount RAS reports as received.
- Email (deviation from spec, which said Resend): copy Roqqu Studio `email.ts` (Brevo or ZeptoMail). Env: `BREVO_API_KEY`, `BREVO_SENDER`. With no key set, the code is returned in the response as a dev hint.
- Other env: `DATABASE_URL`, `SESSION_SECRET`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `PUBLIC_APP_URL`, `ADMIN_EMAILS` (comma-separated).
- Every DB query on creator data filters by the session's `user_id`. Admin routes check `role = 'admin'` on the server.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Test command: `npm test` (Vitest). Integration tests use `startTestDb()` from Task 1.

## Review Focus

1. **Two withdrawals at once exceeding the balance:** the second must fail with "Insufficient balance". `requestWithdrawal` locks the creator row (`select … for update`) before reading the balance. Test in Task 13.
2. **Old username claimed by someone else:** after `ada` renames to `ada_x`, `/@ada` must keep redirecting to `ada_x`, and a new signup for `ada` must be refused. Test in Task 6.
3. **Paid amount differs from the checkout estimate** because the rate moved: the credit equals RAS `amount_received` in USDT, not our estimate. An underpaid payment (`payment_link_failed`) credits nothing. Test in Task 11.
4. **HTML in supporter messages or names:** a message `<img src=x onerror=alert(1)>` renders as text on the public page. In the Share → Website embed, a display name with `"` or `<` is escaped. Tests in Tasks 9 and 17.
5. **Webhook after the creator renamed or paused a goal:** the credit still lands on the right creator (keyed by `creator_id`, not username), and progress still counts it. Test in Task 16.

---

## File Structure

```
show-me-love/
  package.json, next.config.ts, tsconfig.json, tailwind.config.ts, postcss.config.mjs, vitest.config.ts, vercel.json, middleware.ts, .env.example, README.md
  db/schema.sql                       # whole schema + treat catalog seed, idempotent
  scripts/migrate.mjs, scripts/local-db.mjs, scripts/seed-demo.mjs, scripts/smoke.mjs
  public/treats/*.svg                 # own treat illustrations
  src/lib/
    db.ts testing.ts                  # copied
    ras.ts webhookCrypto.ts           # copied + edited
    password.ts email.ts              # copied
    session.ts codes.ts ratelimit.ts auth.ts
    money.ts rates.ts ledger.ts
    usernames.ts catalog.ts creators.ts uploads.ts
    checkout.ts payments.ts stats.ts withdrawals.ts admin.ts
    goals.ts heatmap.ts share.ts reports.ts groups.ts connect.ts
  src/components/ui/                  # Button, Card, Tabs, Drawer, Modal, Toggle, Select, Stat, EmptyState
  src/components/                     # Logo, TreatPicker, Sidebar, CreatorPage (shared by preview + public), BuyCard, WallOfLove
  src/app/
    page.tsx login/ signup/ onboarding/ legal/ docs/
    u/[username]/page.tsx, u/[username]/thanks/page.tsx, u/[username]/goals/[slug]/page.tsx, u/[username]/not-found.tsx
    dashboard/layout.tsx + page.tsx, your-page/, treats/, group/, goals/, withdrawals/, share/, developers/
    admin/layout.tsx + page.tsx, withdrawals/, payments/, reports/
    connect/authorize/page.tsx
    api/…                             # one route.ts per endpoint, thin: parse → lib → JSON
  tests/*.test.ts                     # mirror lib names
  examples/connect-starter/           # tiny Next.js app using the HTTP API
```

Route handlers stay thin: parse input, call a `src/lib` function, and return `{ok:true,…}` or `{error:"…"}` with a status code. All rules live in `src/lib`, where tests hit them directly.

---

## Tier 1 — Core loop (Oct 27–31)

### Task 1: Scaffold, schema, DB harness

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `.env.example`, `src/app/layout.tsx`, `src/app/globals.css`, `db/schema.sql`, `scripts/migrate.mjs`, `scripts/local-db.mjs`
- Copy from Roqqu Studio: `src/lib/biz/db.ts` → `src/lib/db.ts` (rename global `__bizSql` → `__smlSql`), `src/lib/biz/testing.ts` → `src/lib/testing.ts` (schema path `../../db/schema.sql`), `scripts/migrate.mjs`, `scripts/local-db.mjs`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Produces: `db(): Sql`, `setTestDb(sql?)`, `startTestDb(): Promise<{sql, stop()}>`. Tables exactly as in spec §4, plus `webhook_events(event_id pk, event_type, payload jsonb, received_at)`. `ledger_entries.ref` is unique. `payments.ref` is unique. `creators.username` is `citext unique`.
- Scripts: `dev`, `build`, `start`, `test` (`vitest run`), `typecheck`, `db:migrate`, `db:local`.

- [ ] **Step 1: Write the failing test** `tests/schema.test.ts`: `"schema applies twice and has core tables"`. Start the DB and run `schema.sql` a second time (it must be idempotent). Assert that `to_regclass` is non-null for `users, creators, username_history, treat_catalog, payments, group_payments, group_splits, goals, ledger_entries, withdrawals, one_time_codes, apps, api_keys, auth_codes, connections, reports, rate_limits, webhook_events`. Assert `select count(*) from treat_catalog where parent_id is null` ≥ 10.
- [ ] **Step 2: Run** `npm test -- schema`. Expected: FAIL (no schema).
- [ ] **Step 3: Write `db/schema.sql`.**
  - Begin with `create extension if not exists citext;`. Use `create table if not exists` everywhere, and `uuid` ids with `default gen_random_uuid()`.
  - Seed `treat_catalog` with `insert … on conflict (id) do nothing`:
    - Top level: malt, zobo, suya, jollof, coffee, glucose-d, ribena, lucozade, trophy (category `alcohol`).
    - Malt sub-items: 3 brands with `parent_id='malt'`, named "Classic Malt", "Dark Malt", "Gold Malt" (generic names; no trademarks).
    - Trophy sub-items: 2.
    - `image` is `/treats/<id>.svg`.
- [ ] **Step 4: Run** `npm test -- schema`. Expected: PASS.
- [ ] **Step 5: Scaffold the Next app.**
  - `layout.tsx` uses the Inter and Fraunces (italic) Google fonts via `next/font`, `globals.css` holds the Tailwind base, and the tokens go in the Tailwind config.
  - Add a `public/treats/*.svg` set: simple flat illustrations, one per catalog id.
- [ ] **Step 6: Verify** `npm run build` succeeds and `npm run typecheck` is clean.
- [ ] **Step 7: Commit** `chore: scaffold app, schema and test harness`.

### Task 2: RAS client and webhook crypto

**Files:**
- Copy + edit: `src/lib/biz/ras.ts` → `src/lib/ras.ts`, `src/lib/biz/webhookCrypto.ts` → `src/lib/webhookCrypto.ts`
- Test: `tests/ras.test.ts`

**Interfaces:**
- Produces: `rasMode()`, `RasError`, `webhookKey(): string|null`, `createPaymentLink({amountNgn, reference, customer:{email,first_name,last_name}, successUrl, cancelUrl, metadata}): Promise<PaymentLink>`, `sendCoin({token:"usdt", network, to, amount}): Promise<string /*refid*/>`, `networkFee(network): Promise<number>`, `ngnPerUsd(): Promise<number>`, `requeryPayment(reference): Promise<{status:"pending"|"completed"|"failed", amount_received?: string}>`, `refundTransaction(reference): Promise<void>`, `sendStatus(refid): Promise<"queued"|"completed"|"failed">`, `clearRasCache()`. `decryptWebhook(hash, ivHex, apiKey): RasEvent|null`, `encryptWebhook(event, apiKey)`.
- `type Network = "bep20" | "trc20"`. Remove `bitcoin` from `NETWORKS`; delete `generateWallet` and `whatNetwork`.

- [ ] **Step 1: Write failing tests:**
  - `"practice payment link offers only bep20 and trc20"`: wallets' networks deep-equal `["bep20","trc20"]`.
  - `"webhook round-trips"`: `decryptWebhook(...encryptWebhook(ev, k))` equals `ev`.
  - `"garbage webhook is null"`: `decryptWebhook("zz", "00", k) === null`.
  - `"practice requery is completed"`.
- [ ] **Step 2: Run** `npm test -- ras`. Expected: FAIL.
- [ ] **Step 3: Copy the files and apply the edits above.**
  - `requeryPayment` → `POST /transaction/requery` with `{reference}`.
  - `refundTransaction` → `POST /transaction/refund`.
  - `sendStatus` → `GET /transaction/queue/<refid>`.
  - Check exact paths and fields against the RAS docs pages "Requery Transaction", "Refund Transaction" and "Get send/withdrawal queue record by Reference ID". Fetch them with `curl.exe --resolve` as Roqqu Studio's notes describe. Each practice branch returns a success shape.
- [ ] **Step 4: Run** `npm test -- ras`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: RAS client limited to USDT networks`.

### Task 3: Money math and rates

**Files:** Create `src/lib/money.ts`, `src/lib/rates.ts`. Test: `tests/money.test.ts`

**Interfaces:**
- Produces:
  - `ngnToUsdt(ngn: number, ngnPerUsd: number): string`. Rounds up to 2 dp and returns a fixed-2 string.
  - `feeUsdt(amount: string, bps = Number(process.env.PLATFORM_FEE_BPS ?? 500)): string`. Rounds down to 6 dp.
  - `splitAmount(total: string, shares: number[] /*weights*/): string[]`. 6 dp. The remainder goes to index 0, and the parts sum exactly to the total.
  - `getRate(): Promise<{ngnPerUsd: number; at: Date}>`. Throws `RateUnavailable` when there is no rate younger than 10 min.
- Do all decimal math with integer micro-units (`BigInt`, 1 USDT = 1_000_000), never floats.

- [ ] **Step 1: Write failing tests:**
  - `ngnToUsdt(500, 1500) === "0.34"` and `ngnToUsdt(1500, 1500) === "1.00"`.
  - `feeUsdt("10.000000", 500) === "0.500000"`.
  - `splitAmount("10", [1,1,1])` deep-equals `["3.333334","3.333333","3.333333"]`, and the parts sum to `10.000000`.
  - `getRate` uses the cached rate when RAS fails within 10 min. Mock `ngnPerUsd` with `vi.mock("../src/lib/ras")` and advance timers.
  - `getRate` throws `RateUnavailable` after 11 min.
- [ ] **Step 2: Run** `npm test -- money`. Expected: FAIL.
- [ ] **Step 3: Implement.** `getRate` keeps a module-level `{value, at}`. It calls `ngnPerUsd()` only if the value is older than 60 s. On error it falls back to the stored value if that is under 10 min old. Roqqu Studio's `ngnPerUsd` has an env fallback; remove that here so failures surface.
- [ ] **Step 4: Run** `npm test -- money`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: money math and cached rate`.

### Task 4: Ledger

**Files:** Create `src/lib/ledger.ts`. Test: `tests/ledger.test.ts`

**Interfaces:**
- Produces:
  - `type LedgerKind = "credit"|"fee"|"hold"|"release"|"reversal"|"payout"`.
  - `addEntry(tx: Sql, e: {creatorId: string; kind: LedgerKind; amountUsdt: string /*signed*/; ref: string}): Promise<boolean /*false if ref existed*/>`. Uses `on conflict (ref) do nothing`.
  - `balance(creatorId: string, tx?: Sql): Promise<string>`. `coalesce(sum,0)` as a fixed-6 string.
  - `totalReceived(creatorId): Promise<string>`. Sum of credits only.

- [ ] **Step 1: Write failing tests:**
  - credit 10, fee −0.5, hold −3 → balance `"6.500000"`.
  - the same ref twice → the second `addEntry` returns `false` and the balance is unchanged.
  - `totalReceived` = 10.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: append-only ledger`.

### Task 5: Auth — sessions, codes, rate limits, routes

**Files:**
- Copy: `src/lib/biz/password.ts` → `src/lib/password.ts`; `src/lib/biz/email.ts` → `src/lib/email.ts` (sender name `show-me-love`)
- Create: `src/lib/session.ts`, `src/lib/codes.ts`, `src/lib/ratelimit.ts`, `src/lib/auth.ts`, `src/app/api/auth/{signup,login,magic,magic/verify,logout}/route.ts`, `src/app/login/page.tsx`, `src/app/signup/page.tsx`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Produces:
  - `SESSION_COOKIE = "sml_session"`. `setSessionCookie(userId)`, `clearSessionCookie()`, `currentUserId(): Promise<string|null>`, `requireUser(): Promise<{id, email, role}>` (throws `Unauthorized`). JWT is HS256 signed with `SESSION_SECRET`, expires in 30 days.
  - `issueCode(userId, purpose: "login"|"withdrawal", ttlMin: number): Promise<string>`. Login codes are a 32-byte url-safe token; withdrawal codes are 6 digits. Only the sha256 is stored.
  - `consumeCode(userId|null, purpose, code): Promise<string|null /*userId*/>`. Single use, and expired codes return null.
  - `hit(key: string, limit: number, windowSec: number): Promise<boolean /*allowed*/>`.
  - `signUp(email, password): Promise<{id}>`. Role is `admin` if the email is in `ADMIN_EMAILS`. `signIn(email, password): Promise<{id}>`. Both throw `AuthError` with copy suitable for the user.
- Limits: login 10 per 15 min per email+IP; magic-link requests 5 per hour per email.

- [ ] **Step 1: Write failing tests:**
  - signUp then signIn succeeds; a wrong password throws `AuthError("Email or password is wrong.")`.
  - a duplicate email throws `AuthError("That email already has an account.")`.
  - `consumeCode` works once and returns null on the second call; it returns null after expiry (fake timers or `ttlMin: -1`).
  - `hit` allows 3 of `limit 3` and blocks the 4th.
  - an email in `ADMIN_EMAILS` gets role `admin`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the libs, routes and the two pages.**
  - Pages: centered card, email + password, a "Email me a sign-in link" button, links between signup and login.
  - Signup preserves `?treat=&username=` query params and continues to `/onboarding`.
- [ ] **Step 4: Run.** Expected: PASS. Then `npm run build`.
- [ ] **Step 5: Commit** `feat: email/password + magic link auth`.

### Task 6: Usernames and treat catalog

**Files:** Create `src/lib/usernames.ts`, `src/lib/catalog.ts`, `src/app/api/usernames/route.ts`, `src/app/api/treat-catalog/route.ts`. Test: `tests/usernames.test.ts`

**Interfaces:**
- Produces:
  - `usernameProblem(u: string): string|null`. Message: "3–24 letters, numbers or underscores." Also reserves `admin, api, dashboard, login, signup, docs, u, connect, legal, onboarding, settings, support, help`.
  - `usernameAvailable(u): Promise<boolean>`. Checks `creators` and `username_history`.
  - `resolveUsername(u): Promise<{username: string; redirected: boolean}|null>`.
  - `renameUsername(tx, userId, newName): Promise<void>`. Inserts the old name into history.
  - `listCatalog(): Promise<CatalogItem[]>`. Top-level items carry `children`.
- `GET /api/usernames?username=` → `{available, problem}`. Rate limit 60 per min per IP.

- [ ] **Step 1: Write failing tests:**
  - `usernameProblem("ab")` is not null, `"Ada_99"` is null, `"admin"` is not null, `"adé"` is not null.
  - Review Focus #2: create `ada`, rename to `ada_x` → `resolveUsername("ada")` gives `{username:"ada_x", redirected:true}`, and `usernameAvailable("ada") === false`.
  - case-insensitive: `ADA_X` resolves.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: usernames with history and treat catalog API`.

### Task 7: Landing page and onboarding

**Files:**
- Create: `src/components/Logo.tsx`, `src/components/ui/*`, `src/components/TreatPicker.tsx`, `src/app/page.tsx`, `src/app/onboarding/page.tsx`, `src/app/api/onboarding/route.ts`, `src/lib/creators.ts` (create part)
- Test: `tests/onboarding.test.ts`

**Interfaces:**
- Produces: `createCreator(userId, {username, treatId, customTreat?: {name, emoji}}): Promise<Creator>`. Defaults:
  - `display_name = username`
  - `unit_price_ngn = 500`
  - `presets = {1,3,5}`
  - `thank_you_text = "Thanks for the treat. It means a lot."`
  - `share_message = "Feeling good today. Make it better: buy me a treat! 😊"`
  - `page_style = {accent:"honey", tagline:"A little love. A lot of possibility.", header:"default"}`
- `type Creator` (exported from `creators.ts`), used by every later task: all `creators` columns, camelCased.

- [ ] **Step 1: Write failing tests:**
  - `createCreator` with a free username returns the defaults above.
  - a taken username throws `"That username is taken."`.
  - a second creator for the same user throws.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `createCreator` and `POST /api/onboarding`** (requires a session).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Build the landing page `/`.**
  - Two-column hero: big headline "Your good work deserves a little love." with the second line in `cocoa-2`. Subcopy about treats and withdrawing in naira or USDT. A treat illustration on a honey circle.
  - Right card: "01 What should people buy you?" (`TreatPicker`: grid of 9 + Custom; Malt and Trophy show a chevron and open their children in a popover). "02 Claim your username" (prefix `show-me-love/@`, debounced 300 ms check against `/api/usernames`, inline status). "Claim my page" → `/signup?treat=&username=`.
  - Below: 3 feature cards (local treats, pay with USDT, withdraw to bank or wallet), a sample creator page (static `CreatorPage` with demo data), FAQ (5 `<details>`), a closing call to action, and a footer.
- [ ] **Step 6: Build `/onboarding`.** It prefills from the query, confirms treat + username, then POSTs and redirects to `/dashboard`.
- [ ] **Step 7: Verify in the browser** (preview server): claim → signup → onboarding → dashboard. No console errors.
- [ ] **Step 8: Commit** `feat: landing page and onboarding`.

### Task 8: Dashboard shell and Your page editor

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/app/dashboard/layout.tsx`, `src/app/dashboard/your-page/page.tsx`, `src/components/CreatorPage.tsx`, `src/components/BuyCard.tsx`, `src/lib/uploads.ts`, `src/app/api/uploads/route.ts`, `src/app/api/creator/route.ts`
- Modify: `src/lib/creators.ts` (update part)
- Test: `tests/creators.test.ts`

**Interfaces:**
- Consumes: `requireUser`, `renameUsername`, `usernameProblem`.
- Produces:
  - `getCreatorByUser(userId): Promise<Creator|null>`, `getCreatorByUsername(u): Promise<Creator|null>`.
  - `updateCreator(userId, patch: Partial<EditableCreator>): Promise<Creator>`. Validation:
    - `unit_price_ngn` an integer 100–1,000,000
    - `presets` 1–3 distinct integers 1–50
    - `bio` ≤ 280
    - `display_name` 1–50
    - `socials` ≤ 6 https URLs
    - `thank_you_text` ≤ 120
    - `birthday_mode` ∈ `off|show_day|celebrate`
    - username change through `renameUsername`
  - `saveUpload(file: File, kind: "avatar"|"cover"): Promise<string /*url*/>`. PNG/JPEG/WebP only, max 10 MB for avatar and 5 MB for cover, stored with `@vercel/blob` `put`. Without `BLOB_READ_WRITE_TOKEN`, it writes to `public/uploads/` in dev.
  - `<CreatorPage creator={…} mode="preview"|"live" payments={…}/>` is used by both the preview and `/@username`.

- [ ] **Step 1: Write failing tests:**
  - `updateCreator` rejects `unit_price_ngn: 50` with `"Price must be between ₦100 and ₦1,000,000."` and `presets: [0]`.
  - it accepts a valid patch.
  - a username change records history.
  - `saveUpload` rejects `image/gif` and a 6 MB cover.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the libs and `PATCH /api/creator`.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Build the UI.**
  - Sidebar items in spec order, with an active pill style, a collapse toggle, and a mobile drawer. "View your page" is a honey button.
  - Your page: "Make your page yours." Tabs Basics / Treats / Page style with the fields from spec §6. A floating Prev / Next / Save bar where Save is disabled until something changes. Mobile/Desktop preview toggle, an expand button, and "View live page".
  - The preview renders `CreatorPage` from the unsaved form state.
- [ ] **Step 6: Verify in the browser:** edit the name and price, and the preview updates live; Save persists across a reload.
- [ ] **Step 7: Commit** `feat: dashboard shell and page editor with live preview`.

### Task 9: Public creator page

**Files:**
- Create: `middleware.ts`, `src/app/u/[username]/page.tsx`, `src/app/u/[username]/not-found.tsx`, `src/lib/stats.ts` (`publicWall` part)
- Test: `tests/public.test.ts`

**Interfaces:**
- Consumes: `resolveUsername`, `getCreatorByUsername`, `<CreatorPage>`.
- Produces: `publicWall(creatorId, limit = 20): Promise<{name: string; message: string; quantity: number; at: Date}[]>`. Only successful and public payments that carry a message. An empty name becomes "Someone".
- `middleware.ts`: rewrite `^/@([A-Za-z0-9_]+)(/.*)?$` → `/u/$1$2`.

- [ ] **Step 1: Write failing tests:**
  - `publicWall` excludes private, pending and failed payments.
  - Review Focus #4: render `<CreatorPage>` with `react-dom/server` `renderToStaticMarkup` (no extra test library). A wall message `<img src=x onerror=alert(1)>` appears escaped (`&lt;img`).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - The page redirects 308 when `resolveUsername().redirected` is true, and calls `notFound()` when it is null.
  - The 404 shows the logo, "This corner is still unclaimed.", and a "Back to show-me-love" button.
  - Layout: cocoa top bar with logo + "Create your page"; banner card (italic tagline + treat art in a circle); avatar overlapping the banner; name, @handle, heart + thank-you line; "A little wall of encouragement" (empty state: "A little love goes a long way. Be the first to show your support."); right column `BuyCard`; footer with Terms, Privacy, Report page.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Verify in the browser** that `/@<name>` renders, and an unknown name shows the 404.
- [ ] **Step 6: Commit** `feat: public creator page`.

### Task 10: Treat checkout

**Files:**
- Create: `src/lib/checkout.ts`, `src/app/api/checkout/route.ts`, `src/app/api/payments/[ref]/route.ts`, `src/app/u/[username]/thanks/page.tsx`
- Modify: `src/components/BuyCard.tsx` (wire up)
- Test: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: `getRate`, `ngnToUsdt`, `createPaymentLink`, `hit`.
- Produces:
  - `newRef(): string`. 20 chars `[A-Z0-9]`.
  - `startCheckout(input: {kind: "treat"|"goal"|"group"; creatorId?: string; goalId?: string; groupId?: string; quantity?: number; amountNgn: number; supporter: {name: string; email: string; message?: string; isPublic: boolean}; successPath: string}): Promise<{ref: string; url: string}>`.
    - Inserts a pending row with the locked `rate` and `amount_usdt`, then creates the link. `customer.first_name` is the first word of the name ("Supporter" if blank) and `last_name` is the rest ("-" if blank).
    - If RAS fails, sets `status='failed'` with `failure_reason` and throws `CheckoutBusy("Checkout is busy, try again.")`.
    - If there is no rate, throws `CheckoutBusy("Prices are updating, try again in a minute.")`.
  - `paymentStatus(ref): Promise<{status, amountNgn, creatorUsername}|null>`. Calls `expireIfStale` from Task 11 first.
- Validation: quantity 1–50 or a custom amount ≥ the unit price, a valid email, message ≤ 280, name ≤ 50. Rate limit 10 checkouts per 10 min per IP.
- Practice mode: `url` = `/u/<username>/thanks?ref=<ref>&practice=1`. The thanks page shows a "Simulate payment" button in practice mode only, which POSTs to a dev-only route that runs Task 11's handler with an encrypted test event.

- [ ] **Step 1: Write failing tests (RAS in practice mode, DB via `startTestDb`):**
  - qty 3 × ₦500 at a rate of 1500 → the row has `amount_ngn=1500`, `amount_usdt="1.00"`, `rate=1500`, `status='pending'`, and the ref matches `/^[A-Z0-9]{20}$/`.
  - quantity 0 is rejected.
  - when `createPaymentLink` throws (mocked), the row is `failed` and `CheckoutBusy` is thrown.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the lib and routes.**
  - BuyCard: treat image × preset pills, a stepper, "₦X each", "Choose an amount" (number input), name / email / message fields, a "Make it public" toggle, the button "Buy my next {treat} ₦{total}", and "Secure checkout with Roqqu".
  - The thanks page polls `/api/payments/[ref]` every 3 s, stopping after 10 minutes or on a final status, and shows a celebration card on success.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: treat checkout via RAS payment links`.

### Task 11: Webhook, crediting, expiry

**Files:**
- Create: `src/lib/payments.ts`, `src/app/api/ras/webhook/route.ts`, `src/app/api/cron/expire/route.ts`, `src/app/api/dev/simulate/route.ts` (returns 404 unless `rasMode()==="practice"`), `vercel.json`
- Test: `tests/payments.test.ts`

**Interfaces:**
- Consumes: `addEntry`, `feeUsdt`, `splitAmount` (group, Task 20 extends), `decryptWebhook`, `webhookKey`, `requeryPayment`.
- Produces:
  - `handleRasEvent(event: RasEvent): Promise<Outcome>`. Record `webhook_events` first; a duplicate `event_id` → `{handled:false, reason:"duplicate"}`. Look up the payment by `meta_data.payment_reference`; if unknown → `not_ours`.
    - `payment_link_completed` / `_overpaid`: in one `sql.begin`, `select … for update` the payment row, then skip if it isn't pending. Set `successful`, `completed_at`, and `received_usdt = meta.amount_received`. Ledger entries:
      - `credit` with ref `pay:<ref>` and amount `received_usdt`
      - `fee` with ref `fee:<ref>` and amount `-feeUsdt(received)`
      - If kind is `group`, call `creditGroup(tx, payment)` instead (a stub that throws until Task 20).
    - `payment_link_failed`: set `failed`, `failure_reason = "underpaid or failed"`, and no ledger entries.
    - Coin/send events (`event_type` starting `coin_` or `withdrawal`): delegate to `settleSendEvent(event)` from Task 13 (stub until then).
  - `expireIfStale(ref)` and `expireStale(): Promise<number>`. For pending payments older than 60 min: call `requeryPayment`. If it reports completed, process it as a completed event. Otherwise set `expired`.
- Webhook route: read `{hash}` and the `x-api-key` header as the IV. If decryption fails → 400. Otherwise → 200 `{ok:true}`, even when the reference is unknown.
- Cron route: requires `Authorization: Bearer ${CRON_SECRET}`. `vercel.json` crons: `{"path":"/api/cron/expire","schedule":"*/15 * * * *"}`. Vercel Hobby only allows daily crons: if the deploy rejects it, change it to `0 * * * *` on Pro, or rely on lazy expiry plus a daily schedule, and note that in the README.
- Add `received_usdt numeric` to `payments` in `schema.sql` (`alter table … add column if not exists`).

- [ ] **Step 1: Write failing tests:**
  - completed (amount_received "1.00") → status `successful`, balance `"0.950000"`, `totalReceived` `"1.000000"`.
  - Review Focus #3: estimate `1.00` but `amount_received: "1.20"` with `_overpaid` → credit 1.20.
  - the same event twice → balance unchanged.
  - the same payment, different `event_id`, completed twice → still credited once (the row is no longer pending).
  - `payment_link_failed` → `failed`, balance 0.
  - unknown ref → `not_ours`.
  - pending created 61 min ago with a mocked requery → `expired`; with requery completed → `successful`.
  - the route with a bad hash → 400.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Verify in the browser (practice mode):** buy → thanks → Simulate payment → success card.
- [ ] **Step 6: Commit** `feat: RAS webhook crediting and payment expiry`.

### Task 12: Overview and Treats pages

**Files:** Modify `src/lib/stats.ts`. Create `src/app/dashboard/page.tsx`, `src/app/dashboard/treats/page.tsx`. Test: `tests/stats.test.ts`

**Interfaces:**
- Produces:
  - `overview(userId): Promise<{totalReceivedUsdt; balanceUsdt; treatCount; ngnPerUsd: number|null; setup: {page: true; photoBio: boolean; birthday: boolean}; recent: PaymentRow[] /*5*/}>`.
  - `listPayments(userId, filter: "successful"|"pending"|"expired"|"failed"|"refunded"|"all", page = 1): Promise<{rows: PaymentRow[]; count: number}>`. 25 per page, newest first.
  - `PaymentRow = {ref, from, message, quantity, amountNgn, amountUsdt, status, kind, viaGroup: boolean, createdAt}`.

- [ ] **Step 1: Write failing tests:** one each of successful, pending and failed → `overview.treatCount === 1`; `listPayments("all").count === 3`; `listPayments("pending").rows[0].status === "pending"`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the libs and pages.**
  - Overview: "Welcome back, {name}." with Share my page / Edit page buttons. 3 stat cards; the first is the honey-tinted one. Amounts show "$X.XX · ≈ ₦Y". Page setup checklist "n of 3 complete". Recent treats table with an empty state.
  - Treats: "Your treats" with the status select, a count, and empty-state copy per filter.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: overview and treats pages`.

### Task 13: Withdrawals

**Files:** Create `src/lib/withdrawals.ts`, `src/app/dashboard/withdrawals/page.tsx`, `src/app/api/withdrawals/{route.ts,code/route.ts,destination/route.ts}`. Test: `tests/withdrawals.test.ts`

**Interfaces:**
- Consumes: `balance`, `addEntry`, `issueCode`, `consumeCode`, `networkFee`, `sendCoin`, `sendStatus`, `getRate`, `sendMail`.
- Produces:
  - `setDestination(userId, d: {kind:"usdt"; network:"bep20"|"trc20"; address: string} | {kind:"bank"; bankName: string; accountNumber: string /*10 digits*/; accountName: string})`. BEP20 addresses match `^0x[0-9a-fA-F]{40}$`; TRC20 addresses match `^T[1-9A-HJ-NP-Za-km-z]{33}$`.
  - `quoteWithdrawal(userId, method, amountUsdt): Promise<{feeUsdt; receives: string; receivesNgn?: number}>`. For USDT the fee is `networkFee`; for NGN it is `NGN_PAYOUT_FEE / rate`.
  - `requestWithdrawal(userId, {method; amountUsdt; code}): Promise<Withdrawal>`.
    - Order: consume the code, then `select … from creators where user_id=$1 for update`, then check balance ≥ amount, then the daily cap: sum of today's withdrawals (UTC) in USD + amount ≤ `DAILY_WITHDRAW_USD`.
    - Then insert the withdrawal and add a `hold` entry `-amount` with ref `hold:<id>`.
    - Status: `ngn_bank` → `awaiting_review`. `usdt` with an account under 24 h old → `awaiting_review`. Otherwise call `dispatchUsdt(id)`.
  - `dispatchUsdt(id)`: status `processing`, then `sendCoin({token:"usdt", network, to, amount: receives})` and store `ras_reference`. On throw: status `failed`, a `release` entry `+amount` with ref `release:<id>`, and an email to the admins.
  - `settleSendEvent(event)` and `pollProcessing()`: map the RAS send status `completed` → `paid`, and write a `payout` entry `0` with ref `payout:<id>` as a marker. The hold stays as the debit. `failed` → as above.
  - Errors: `"Insufficient balance."`, `"That code is wrong or expired."`, `"Daily limit reached. Try again tomorrow."`, `"Add a payout destination first."`.
- Run `pollProcessing()` from the cron route of Task 11 as well.

- [ ] **Step 1: Write failing tests (practice RAS):**
  - balance 10, withdraw 4 USDT with a valid code on a 2-day-old account → `processing` then `paid` after `pollProcessing`; balance `"6.000000"`.
  - a 1-hour-old account → `awaiting_review`.
  - an `ngn_bank` withdrawal → `awaiting_review`.
  - a reused code → error.
  - Review Focus #1: balance 10, two parallel `requestWithdrawal` calls of 8 each (separate codes) → exactly one succeeds and the other throws `"Insufficient balance."`.
  - `sendCoin` throws → `failed` and the balance is restored to 10.
  - daily cap 500 with an attempted 501 → error.
  - a bad BEP20 address is rejected.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the lib, routes and page.**
  - Page: "Your withdrawals" + "Make a withdrawal". An available card with a refresh icon. A destination card (bank name + masked account, or network + short address) with Change, which opens a modal with USDT/Bank tabs.
  - History table: destination, amount + fee, status chip ("Awaiting review", "Processing", "Paid", "Rejected", "Failed"), date. A note line for review: "New accounts are reviewed during their first day."
  - Modal: "Withdraw from" select (USDT wallet / NGN bank), available row, an amount field with "Use full balance", the "To …" line, a fee box with "Your destination receives", then "Send code" → a 6-digit input → "Withdraw".
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: USDT and NGN withdrawals with holds`.

### Task 14: Admin

**Files:** Create `src/lib/admin.ts`, `src/app/admin/{layout.tsx,page.tsx,withdrawals/page.tsx,payments/page.tsx}`, `src/app/api/admin/withdrawals/[id]/route.ts`. Test: `tests/admin.test.ts`

**Interfaces:**
- Produces:
  - `requireAdmin(): Promise<{id}>`. Throws `Forbidden`.
  - `approveWithdrawal(adminId, id)`: `awaiting_review` USDT → `dispatchUsdt`.
  - `markNgnPaid(adminId, id, bankReference: string)`: `ngn_bank`+`awaiting_review` → `paid`, plus a `payout` marker entry.
  - `rejectWithdrawal(adminId, id, note)`: → `rejected` plus a `release` entry.
  - `searchPayments(q)`: ref, username or email; 50 rows.
- The API route takes `{action:"approve"|"paid"|"reject", bankReference?, note?}`.

- [ ] **Step 1: Write failing tests:**
  - a non-admin calling `approveWithdrawal` → `Forbidden` (test through the route handler with a session cookie, or through `requireAdmin` with a mocked `currentUserId`).
  - `rejectWithdrawal` restores the balance.
  - `markNgnPaid` requires a non-empty `bankReference`.
  - approving an already-paid withdrawal → error `"Not awaiting review."`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement the libs, route and pages** (queue table with action buttons; payments search).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: admin withdrawal review`.

### Task 15: Tier 1 deploy and smoke test

**Files:** Create `scripts/smoke.mjs`, `README.md`, `.env.example` (complete), and `scripts/seed-demo.mjs`, which creates a demo creator `demo` with 3 successful treats via encrypted practice events.

- [ ] **Step 1: Write `scripts/smoke.mjs` (Playwright, `npx playwright` as a devDependency).**
  - Run against `BASE_URL`: claim `smoke_<ts>` → signup → onboarding → edit price → open `/@smoke_<ts>` → buy 1 → Simulate payment.
  - Assert that "Treats received" shows 1 on the overview.
  - Withdraw to a test BEP20 address: in practice mode the dev hint code appears on the page; use it. Then an admin user (from `ADMIN_EMAILS`) approves if needed, and the row shows "Paid".
- [ ] **Step 2: Run locally:** `npm run db:local`, `npm run build && npm start`, `BASE_URL=http://localhost:3000 node scripts/smoke.mjs`. Expected: exit 0.
- [ ] **Step 3: Push and deploy.**
  - `git remote add origin https://github.com/Obiajulu-gif/show-me-love.git`, then push using the Obiajulu-gif token via a one-off credential helper (see the Roqqu Studio memory note).
  - `vercel deploy --prod`. Set the non-secret env yourself.
  - Ask the user to add the secrets: `DATABASE_URL`, `SESSION_SECRET`, `RAS_TEST_KEY`, `BREVO_API_KEY`, `BREVO_SENDER`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `ADMIN_EMAILS`.
  - Run `npm run db:migrate` against Neon and redeploy.
- [ ] **Step 4: Ask the user to register** `https://<host>/api/ras/webhook` in RAS. Then create one real test-mode link and pay it (spec §10 live check). Expected: a treat appears.
- [ ] **Step 5: Commit** `chore: smoke script, seed and deploy docs`.

---

## Tier 2 — Goals, Share, Wall of love, reports (Nov 1–3)

### Task 16: Goals

**Files:** Create `src/lib/goals.ts`, `src/app/dashboard/goals/page.tsx`, `src/components/GoalDrawer.tsx`, `src/app/u/[username]/goals/[slug]/page.tsx`, `src/app/api/goals/{route.ts,[id]/route.ts}`. Test: `tests/goals.test.ts`

**Interfaces:**
- Consumes: `startCheckout` (kind `goal`), `saveUpload("cover")`.
- Produces:
  - `createGoal(userId, input): Promise<Goal>`. `slug` = slugified title plus `-n` when it collides. Validation: title 3–80, story ≤ 2000, `currency ∈ NGN|USD`, `target > 0`, `suggested > 0`, `header_mode ∈ default|logo|hidden`.
  - `updateGoal(userId, id, patch)`: changing the currency once `currency_locked` is set → error `"Currency locks when the first checkout starts."`.
  - `setPaused(userId, id, paused)`.
  - `goalProgress(goalId): Promise<{raised: number /*in goal currency*/; count: number}>`. Sums successful payments before fees, using `amount_ngn` for NGN and `received_usdt` for USD.
  - `startGoalCheckout(goalId, amount, supporter)`: a paused goal → error `"This goal is paused."`. Sets `currency_locked=true`. For USD goals, `amountNgn = amount × rate`.

- [ ] **Step 1: Write failing tests:**
  - create → slug `help-me-buy-a-camera`, and a second goal with the same title gets `…-2`.
  - checkout locks the currency, and a later currency change fails.
  - a paused goal refuses checkout.
  - progress counts only successful payments.
  - Review Focus #5: start a checkout, pause the goal and rename the creator's username, then complete the webhook → the creator balance is credited and `goalProgress.count === 1`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Dashboard: "Your goals" with an empty state card and a goal list (cover, title, progress bar, paused chip, copy link, edit, pause).
  - Drawer fields in the screenshot order: title, story, cover, currency select, target, suggested contribution, two toggles with their help text, Goal organizer (name, photo, preview chip), Goal header radio, info note, Cancel / Save goal.
  - Public goal page: header per `header_mode`, cover, title, "A goal by {organizer}", story, a progress bar (only if `show_progress`), the target (only if `show_target`), an amount input prefilled with `suggested`, and a contributors list (only if `show_progress`).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: goals with currency lock and pause`.

### Task 17: Share page

**Files:** Create `src/lib/share.ts`, `src/app/dashboard/share/page.tsx`. Test: `tests/share.test.ts`

**Interfaces:**
- Produces:
  - `creatorLink(username): string` = `${PUBLIC_APP_URL}/@${username}`.
  - `shareText(message, link): string` = message + `\n` + link.
  - `xIntent(text)` → `https://x.com/intent/post?text=…`, `whatsappLink(text)` → `https://wa.me/?text=…`.
  - `embedHtml(creator): string`: a standalone `<a>` with inline styles, the treat label "Buy me some {treat}", and HTML-escaped values.
- Tabs via `?tab=social|website|qr|apps`:
  - Social & links: link + copy, an editable share message saved to `share_message`, X and WhatsApp buttons.
  - Website: a live button preview with a "Matches your page" chip, and Copy HTML embed.
  - QR Code: Branded card / Compact QR toggle, an OBS info note, and the card (logo, "Buy me some {treat}", QR via `qrcode.react` `QRCodeCanvas`, @handle, a "Scan to support" pill). Download PNG via `canvas.toDataURL`.
  - Connected apps: empty state "No connected apps yet." until Task 22.

- [ ] **Step 1: Write failing tests:**
  - Review Focus #4: `embedHtml({displayName:'A"<b>', …})` contains `A&quot;&lt;b&gt;` and does not contain `<b>`.
  - `xIntent("hi & bye")` url-encodes the `&`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: share page with embed and QR`.

### Task 18: Wall of love heatmap

**Files:** Create `src/lib/heatmap.ts`, `src/components/WallOfLove.tsx`. Modify `src/app/u/[username]/page.tsx`. Test: `tests/heatmap.test.ts`

**Interfaces:**
- Produces:
  - `heatmap(dates: Date[], today: Date): {weeks: {date: string /*YYYY-MM-DD UTC*/; count: number; level: 0|1|2|3}[][]; months: {label: string; col: number}[]}`.
    - 12 columns (weeks) × 7 rows (Mon–Sun). The last column contains `today`.
    - Levels: 0 → 0, 1 → 1, 2–3 → 2, ≥4 → 3.
    - Month labels go on the first column where a month starts ("Aug", "Sept", "Oct" style: use `toLocaleString("en-GB",{month:"short", timeZone:"UTC"})`).
- The component draws rounded squares with a tooltip ("27 Aug 2026" + "No public treats on this day." / "n public treats"), a "Public treats · UTC" footer, a Less/More legend, and the empty line "Your first treat will light up this space."

- [ ] **Step 1: Write failing tests:**
  - `today = 2026-10-26` (a Monday) → 12 weeks, and the last week's first cell is `2026-10-26`.
  - two dates on the same day → count 2, level 2.
  - a date older than 84 days is ignored.
  - a payment at 23:30 UTC lands on the UTC date.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement it and add it to the public page** (fed by public successful payment dates).
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: wall of love heatmap`.

### Task 19: Reports and refunds

**Files:** Create `src/lib/reports.ts`, `src/app/api/reports/route.ts`, `src/app/admin/reports/page.tsx`, `src/components/ReportDialog.tsx`. Modify `src/lib/admin.ts` and `src/app/admin/payments/page.tsx`. Test: `tests/reports.test.ts`

**Interfaces:**
- Produces:
  - `submitReport({username, reason: "spam"|"impersonation"|"scam"|"inappropriate"|"other", details ≤ 1000, reporterEmail?})`. Rate limit 5 per hour per IP.
  - `resolveReport(adminId, id)`.
  - `refundPayment(adminId, ref)`: only `successful` payments; call `refundTransaction(ref)`, then add `reversal` entries `-received` with ref `rev:<ref>` and `+fee` with ref `revfee:<ref>`, and set `refunded`. If the balance would go negative, still refund, and show the negative balance in admin.

- [ ] **Step 1: Write failing tests:**
  - a refund of a successful 1.00 payment brings the balance from 0.95 to 0.
  - refunding a pending payment → error `"Only successful payments can be refunded."`.
  - the report rate limit blocks the 6th report.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add "Report page" in the public footer to open the dialog, and a Refund button in admin payments.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Deploy Tier 2** (`vercel deploy --prod`) and re-run the smoke script against production in practice mode. Expected: exit 0.
- [ ] **Step 6: Commit** `feat: reports and refunds`.

---

## Tier 3 — Groups and Developers/Connect (Nov 4–6)

### Task 20: Support a group

**Files:** Create `src/lib/groups.ts`, `src/app/dashboard/group/page.tsx`, `src/app/api/groups/{check/route.ts,route.ts}`. Modify `src/lib/payments.ts` (`creditGroup`) and `src/lib/stats.ts` (`viaGroup`). Test: `tests/groups.test.ts`

**Interfaces:**
- Consumes: `splitAmount`, `startCheckout` (kind `group`), `addEntry`, `feeUsdt`.
- Produces:
  - `parseUsernames(text): string[]`. Splits on commas or newlines, trims, strips a leading `@`, lowercases, and dedupes.
  - `checkGroup(names): Promise<{ok: {username, displayName, photoUrl}[]; missing: string[]}>`.
  - `startGroupCheckout(payerUserId, {usernames: string[] /*2–10*/; currency: "NGN"|"USD"; total: number; split: "even"|{custom: Record<string, number>}; message?; isPublic}): Promise<{ref; url}>`. The custom split must sum to the total. The payer cannot include themselves.
  - `creditGroup(tx, payment)`: split the received USDT by share weights; per creator, a `credit` with ref `pay:<ref>:<creatorId>` and a `fee` with ref `fee:<ref>:<creatorId>`.
  - `groupHistory(payerUserId)`.
- Page tabs Add support / History:
  - Input with Add; chips with avatar and name, with remove; an NGN/USD select; the total amount; Split settings (Even / Custom with per-person amounts); a confirm list; Pay.
  - Empty state: "Your group starts with a username."

- [ ] **Step 1: Write failing tests:**
  - `parseUsernames("@Ada, bob\nada")` deep-equals `["ada","bob"]`.
  - 1 username → error `"Add 2–10 creators."`; 11 → the same.
  - an even split of 10.00 across 3 → credits `3.333334, 3.333333, 3.333333` and each creator is charged their own fee.
  - a custom split that doesn't sum → error.
  - the group appears as `viaGroup` in each creator's `listPayments`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: support a group with split checkout`.

### Task 21: Developer apps and keys

**Files:** Create `src/lib/connect.ts` (apps/keys part), `src/app/dashboard/developers/page.tsx`, `src/app/api/developers/{apps/route.ts,apps/[id]/keys/route.ts}`. Test: `tests/connect-apps.test.ts`

**Interfaces:**
- Produces:
  - `createApp(userId, {name: 3–60; mode: "sandbox"|"live"; redirectUris: string[] /*1–5, https or http://localhost*/}): Promise<App>`. `client_id` = `sml_app_` + 16 hex.
  - `createKey(userId, appId): Promise<{key: string /*shown once*/; prefix; last4}>`. The key is `sml_test_`/`sml_live_` + 32 bytes base64url, stored as sha256.
  - `revokeKey(userId, keyId)`.
  - `authenticateApp(clientId, apiKey): Promise<App|null>`. Constant-time compare, and the key must not be revoked.
  - `redirectAllowed(app, uri): boolean`. Exact string match.
- Page:
  - "Developers" with a Live/Sandbox segmented toggle and an Integration guide button.
  - Empty state: "Bring show-me-love to your platform" with "Create your first app".
  - App cards list the client id, redirect URIs, and keys (prefix…last4, revoke). Generate key shows the key once in a modal with copy.
  - Starter configuration block: `SML_ORIGIN, SML_CLIENT_ID, SML_API_KEY, APP_ORIGIN, SML_REDIRECT_URI`.

- [ ] **Step 1: Write failing tests:**
  - a sandbox app's key starts with `sml_test_`.
  - `authenticateApp` succeeds with the key and fails after revoke.
  - `redirectAllowed` rejects a trailing-slash variant and a different host.
  - `ftp://` is rejected at create time.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: developer apps and API keys`.

### Task 22: Connect flow and Connected apps

**Files:** Modify `src/lib/connect.ts`. Create `src/app/api/connect/{sessions,token,connection,earnings,disconnect}/route.ts`, `src/app/connect/authorize/page.tsx`, `src/app/api/connect/authorize/route.ts`. Modify `src/app/dashboard/share/page.tsx` (apps tab). Test: `tests/connect-flow.test.ts`

**Interfaces:**
- Consumes: `authenticateApp`, `redirectAllowed`, `hit`.
- Produces:
  - `createSession(app, {userRef: string ≤ 128; redirectUri; state ≤ 256}): string /*authorize_url*/`. It is a signed `jose` JWT in the query (`?req=`) with a 10-min expiry. The redirect URI must be allowed.
  - `approve(userId, req, {earnings: boolean}): Promise<string /*redirect url with code+state*/>`. The code is 32 bytes base64url, sha256-stored, 10-min expiry. `deny(req)` returns `redirect_uri?error=access_denied&state=…`.
  - `exchangeCode(app, code): Promise<{connected: true}>`. Single use. It upserts `connections(app, user_ref)`, clearing `revoked_at`.
  - `getConnection(app, userRef): Promise<{username; display_name; support_url; earnings_shared}|null>`.
  - `getEarnings(app, userRef)`: if not shared → throw `Forbidden`. Sandbox apps return a fixed fake `{total_received:"12.50", currency:"USDT", treats: 5}`. Live apps return the real `totalReceived` and the count.
  - `disconnect(app, userRef)`, `revokeByCreator(userId, appId)`, `listConnectedApps(userId)`.
- HTTP API (all JSON; app auth via the `Authorization: Bearer <api_key>` and `X-Client-Id` headers):
  - `POST /api/connect/sessions` → `{authorize_url}`.
  - `POST /api/connect/token {code}` → `{connected:true}`.
  - `GET /api/connect/connection?user_ref=` → 200 / 404.
  - `GET /api/connect/earnings?user_ref=` → 200 / 403 / 404.
  - `POST /api/connect/disconnect {user_ref}` → 200.
  - Rate limit 120 per minute per app.
- Authorize page: requires login (redirects to `/login?next=`). Shows the app name and mode badge, what it gets ("Your public page link" always; "Your earnings" as an unchecked checkbox), and Allow / Deny.
- Share → Connected apps lists the app name, connected date, an "earnings shared" chip, and Revoke.

- [ ] **Step 1: Write failing tests:**
  - full flow: session → approve(earnings:false) → exchange → `getConnection` has `support_url` ending `/@ada`; `getEarnings` → `Forbidden`.
  - code reuse → error `"Code is invalid or expired."`.
  - deny → the url has `error=access_denied` and the original state.
  - after `revokeByCreator`, `getConnection` → null.
  - a session with an unregistered redirect → error.
  - a sandbox app with earnings shared → the fake earnings shape.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: Connect authorization flow`.

### Task 23: Docs, integration guide, starter

**Files:** Create `src/app/docs/page.tsx`, `src/components/IntegrationGuide.tsx` (the drawer opened from Developers with `?guide=open`), `examples/connect-starter/` (a minimal Next.js app: `app/page.tsx` with a Connect button, and `app/api/sml/{connect,callback,disconnect}/route.ts` calling the HTTP API), `src/app/legal/page.tsx`.

- [ ] **Step 1: Write `/docs`.** Sections: Overview, Quickstart (5 steps), HTTP API reference (each endpoint: method, headers, body, responses including 403/404), Security checklist (keys server-side only, user_ref from your own session, exact redirect, test deny and revoke), Going live.
- [ ] **Step 2: Build `IntegrationGuide`** with Manual / AI assistant tabs.
  - Manual: install note (no package; use `fetch`), env block, a route snippet, a "show support link" snippet, smoke-test steps.
  - AI assistant: one copyable prompt describing the HTTP API and the env names.
- [ ] **Step 3: Build the starter.** Its README covers: paste sandbox env, `npm i && npm run dev`, click Connect.
- [ ] **Step 4: Verify end to end in the browser:** run the starter on :3001 against the local app on :3000 with a sandbox app, then Connect → Allow → the support link shows → revoke from Share → the starter shows "not connected".
- [ ] **Step 5: Write `/legal`** (Terms and Privacy anchors; plain-language placeholder terms written for this product).
- [ ] **Step 6: Commit** `docs: developer docs, integration guide and starter`.

### Task 24: Final pass and demo readiness

- [ ] **Step 1: Extend `scripts/smoke.mjs`:** create a goal and pay it; pay a group of 2; create a sandbox app and run the Connect flow with `fetch`. Expected: exit 0 locally and against production (practice mode).
- [ ] **Step 2: Responsive pass:** check 375 px width on the landing page, public page, dashboard (drawer) and modals. No horizontal scroll.
- [ ] **Step 3: Run** `npm test`, `npm run typecheck` and `npm run build`. Expected: all green.
- [ ] **Step 4: Switch production to `RAS_MODE=test`** (the user adds `RAS_TEST_KEY`). Run one real test-mode payment and one USDT test withdrawal. Record the results in the README.
- [ ] **Step 5: Run `scripts/seed-demo.mjs`** on production for the demo creator.
- [ ] **Step 6: Commit and deploy** `chore: demo readiness`. Update the memory note with the live URLs.
