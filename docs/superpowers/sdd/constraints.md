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

