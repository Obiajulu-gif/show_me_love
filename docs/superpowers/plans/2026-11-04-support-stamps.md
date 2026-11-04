# Support Stamps plan (2026-11-04)

Goal: supporters make a branded stamp for a creator and share it; every stamp carries the creator’s link and QR.

Spec: `docs/superpowers/specs/2026-11-04-support-stamps-design.md`

Global constraints: warm Paper theme only; no new dependencies; photo stays client-side; one campaign per creator; schema stays idempotent.

## Task 1: schema (TDD)

- Add `stamp_campaigns` and `stamps` to `db/schema.sql`, with the style check, unique creator, cascades, and both indexes.
- Add both tables to `tests/schema.test.ts`.
- Run the schema twice in the test to keep idempotence covered.

## Task 2: `src/lib/stamps.ts` (TDD)

- Types + style constants.
- `sanitizeStampName`, `sanitizeStampHandle`, `StampInputError`.
- `getCampaignByCreator`, `getActiveCampaignByCreator`.
- `saveCampaign(creatorId, input, defaultStyle)` — merge, validate, upsert.
- `recordStamp(...)` — insert then count.
- `stampStats(creatorId)` — total, week, recent 10.
- Tests: defaults, style fallback, trim, pause, count, ordering, sanitization, rate limit.

## Task 3: `src/lib/stampCanvas.ts` (TDD)

- Palette table, canvas constants.
- `coverScale`, `clampOffset`, `fitText`.
- `drawStamp` with photo clipping, perforation, postmark, name/handle, supporter pill, bottom card, QR, placeholder.
- Tests: cover both orientations, clamping, text fitting.

## Task 4: APIs

- `POST /api/stamps/campaign` — auth, cross-site guard, validation, upsert.
- `POST /api/stamps` — cross-site guard, UUID check, IP + campaign limits, active gate, sanitize, insert, count.
- Friendly errors; 400/404/429.

## Task 5: dashboard

- Add Stamps to `Sidebar`.
- `/dashboard/stamps` server page with campaign, stats, link.
- `StampManager` client: style cards, headline, active toggle, preview, save, QR, copy, open studio, recent list, empty state.
- `StampPreview` client canvas.

## Task 6: public studio

- `/@username/stamp` server page: resolve username, active campaign, origin, treat name; metadata + noindex.
- `StampStudio` client: photo picker/drop, drag + zoom, name/handle, live canvas, download, record, share actions, privacy copy, mobile layout.

## Task 7: entry points

- `CreatorPage` optional `stampHref`; render the link under `BuyCard`.
- Public creator page loads the active campaign and passes the href.
- Thanks page loads the campaign; `ThanksStatus` success card links to the studio.

## Task 8: verify and ship

- `npm run typecheck`, `npm run test`, `npm run build`.
- Browser check at 1440/390/320: dashboard manager, public studio, download, mobile.
- Screenshots into `docs/screenshots/`.
- Self-review diff, commit, push, PR against `build/show-me-love`.
