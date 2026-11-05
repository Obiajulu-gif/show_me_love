# show-me-love

Small treats, real support.

Live site: [show-me-love.vercel.app](https://show-me-love.vercel.app/)

show-me-love lets a creator claim a link like `/@ada`, pick a small treat their supporters can buy them (a zobo, a coffee, a custom one), and get paid in USDT. Supporters pay by Roqqu payment link, the app credits the creator when Roqqu confirms, and the creator withdraws to a USDT wallet or a Nigerian bank account. Admins review early or bank withdrawals.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Tailwind 3, Postgres (`postgres` driver), `jose` sessions, Roqqu API Service (RAS) for payments and payouts, Brevo for email, Vercel Blob for images, Vitest for tests, Playwright for the smoke script.

## Run it locally

You need Node 22+. No accounts or keys are required: practice mode simulates Roqqu.

```bash
npm install
npm run db:local          # keep running: local Postgres (PGlite) on :54330, schema applied
cp .env.example .env.local   # then set SESSION_SECRET, CRON_SECRET and ADMIN_EMAILS
npm run build && npm start   # http://localhost:3000
```

`npm run dev` works too. Without an email provider, withdrawal codes and sign-in links are shown on screen, but only when `NODE_ENV` is not `production`, so use `npm run dev` for anything that needs them (the smoke script does).

## Tests

```bash
npm test            # Vitest, uses its own in-memory database
npm run typecheck
```

## Smoke test

An end-to-end run in a real browser. Tier 1, the money loop: claim a username, sign up, onboard, change the price, buy a treat, simulate the payment, withdraw, approve as admin, see "Paid". Tier 2: create a goal and pay it (the dashboard shows the progress), sign up two more creators and pay a group of them (both see a "group" row), create a sandbox app and API key in Developers, then run the whole Connect flow over HTTP (sessions, Allow, token, connection) and revoke it from Share.

```bash
# server: npm run dev, practice mode, with these set
#   ADMIN_EMAILS=smoke+admin@show-me-love.test   CRON_SECRET=<anything>
CRON_SECRET=<same value> BASE_URL=http://localhost:3000 node scripts/smoke.mjs
```

It exits non-zero and names the failing step if anything breaks. It takes about three minutes, because a send only settles after it has been processing for two minutes; the script calls `/api/cron/expire` every 15 seconds until the row is Paid. You may need `npx playwright install chromium` once. Signups are rate limited to 10 per hour per IP (a run uses four), so restart `db:local` on a clean `.pglite` folder if you rerun it many times.

## Responsive check

`BASE_URL=http://localhost:3000 node scripts/responsive.mjs` opens the key screens at 375 px wide, fails on any horizontal scroll, and saves screenshots to `docs/screenshots/375/`.

## Demo data

```bash
DEMO_PASSWORD='pick-a-password' BASE_URL=http://localhost:3000 node scripts/seed-demo.mjs
```

Creates the creator `demo` (`demo@show-me-love.test`) with a bio and three paid treats with public notes. It goes through the app's practice-mode routes, refuses to run if the app is not in practice mode, and is safe to run twice.

## Roqqu (RAS) modes

| `RAS_MODE` | What happens | Keys |
| --- | --- | --- |
| `practice` | Every call is simulated. `/api/dev/simulate` marks a payment paid. The default when no keys are set. | none |
| `test` | Real calls to Roqqu's staging service. | `RAS_TEST_KEY` |
| `live` | Real money. | `RAS_LIVE_KEY` and `ALLOW_PRODUCTION_EXECUTION=true` |

Live mode refuses to send anything unless `ALLOW_PRODUCTION_EXECUTION` is exactly `true`. Outside production, if `RAS_MODE` is unset the app picks `test` when only a test key exists, `live` for a live key, and `practice` otherwise. In production (`NODE_ENV=production`) `RAS_MODE` must be set explicitly, and `practice` is refused unless `ALLOW_PRACTICE=true`; the server also refuses to start with a missing `PUBLIC_APP_URL`, a `SESSION_SECRET` under 32 characters, or no email provider. The Simulate payment route and buttons exist only in practice mode.

Webhook: register `https://<your-host>/api/ras/webhook` in the RAS dashboard. Events are encrypted with the key for the current mode and are what credit a creator.

Cron: `/api/cron/expire` expires stale pending payments and settles sends. It needs `Authorization: Bearer $CRON_SECRET`. On Vercel Hobby, crons may only run daily, so `vercel.json` schedules it at 03:00 UTC. Pending payments also expire lazily whenever their status is read.

**Cron frequency.** On Vercel Hobby the safety-net cron runs once a day, so a missed `token_sent` webhook can leave a withdrawal showing "Sending" for up to 24 hours. For tighter settling, point an external scheduler (cron-job.org, a VPS crontab, etc.) at the route every 5 minutes:

```
*/5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<your-host>/api/cron/expire
```

Admin role: addresses in `ADMIN_EMAILS` become admins only after a successful magic-link sign-in (which proves they own the inbox), never at signup or password login.

## Deploy (pending approval)

Demo-readiness checklist (each step waits for approval):

- [ ] Switch the production deployment to `RAS_MODE=test` once `RAS_TEST_KEY` is added.
- [ ] Make one real test-mode payment and one USDT test withdrawal, and record the results here.
- [ ] Run `scripts/seed-demo.mjs` against production for the demo creator (it needs practice mode, so run it before the switch or against a practice deployment).
- [ ] Deploy and update the memory note with the live URLs.


Nothing has been pushed or deployed yet. When approved:

1. Create a Neon Postgres database and run `DATABASE_URL=<neon url> npm run db:migrate`.
2. Push the repo and import it into Vercel.
3. Set these environment variables:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon connection string (secret) |
| `SESSION_SECRET` | long random string (secret) |
| `PUBLIC_APP_URL` | the deployed origin, no trailing slash |
| `RAS_MODE` | `test` first |
| `RAS_TEST_KEY` | from the RAS dashboard (secret) |
| `RAS_LIVE_KEY`, `ALLOW_PRODUCTION_EXECUTION` | only when going live |
| `BREVO_API_KEY`, `BREVO_SENDER` | email for codes and sign-in links (secret) |
| `BLOB_READ_WRITE_TOKEN` | image uploads (secret) |
| `CRON_SECRET` | any long random string (secret) |
| `ADMIN_EMAILS` | comma-separated admin emails |
| `PLATFORM_FEE_BPS`, `NGN_PAYOUT_FEE`, `DAILY_WITHDRAW_USD` | optional, defaults `500`, `50`, `500` |

4. Register `https://<host>/api/ras/webhook` in RAS, then create one test-mode link and pay it. A treat should appear on the creator's overview.
