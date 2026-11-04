# Support Stamps — Design Spec

Date: 2026-11-04
Status: approved in chat

## 1. Intent

A supporter puts their photo on a branded “postage stamp” for a creator, downloads it, and shares it. Every stamp carries the creator’s `@handle` and a QR code to their page, so each share is a referral.

This is the SocialStamp mechanic scoped to show-me-love: no event management, ticketing, payments, or new accounts. It reuses creator accounts, public pages, the treat catalog, QR generation, the dashboard, and rate limiting.

Why it fits:

- **Growth loop.** The stamp is the ad: a supporter’s face, the creator’s handle, and a scannable link.
- **On-brand.** Warm paper, perforated stamp edge, postmark, creator accent. Nothing blue.
- **Private by design.** The selfie never leaves the browser. Only name and handle are stored.
- **Small surface.** One campaign per creator, three built-in styles, no new dependencies.

## 2. Scope

### In v1

- One campaign per creator.
- Three built-in styles: `honey`, `cocoa`, `sage`; defaults to the creator’s page accent.
- Editable headline (default “I support”), active/paused toggle.
- Public studio at `/@username/stamp`.
- 1080×1350 PNG download with creator name, handle, treat CTA, and QR.
- Share via Web Share (with the image file where supported), X, WhatsApp, and copy link.
- Dashboard manager with live preview, public link, QR, total/week stats, and the recent 10 stamps.
- Entry points: creator page (only when active), thanks page (only when active), sidebar.

### Out of v1

Custom frame uploads, multiple campaigns, public stamp gallery, CSV export, event fields, billing, stamp goals.

## 3. UX

### Creator

1. Sidebar → **Stamps** (`/dashboard/stamps`).
2. First visit: style picker, headline, live preview, **Publish**.
3. Publishing creates the campaign and sets `active = true`.
4. After publish: public link `/@username/stamp`, QR, **Open studio**, stats, recent stamps.
5. Pausing hides the creator-page and thanks-page entry points; `/@username/stamp` returns 404.

### Supporter

1. Opens `/@ada/stamp` from the creator page, thanks page, or a shared link.
2. **Photo:** file picker or drag-and-drop. Copy states “Your photo never leaves this device.”
3. **Place:** drag to reposition, zoom slider 1×–3×, **Center** reset.
4. **Sign:** optional name and handle.
5. Live preview updates as they type or move the photo.
6. **Download:** saves `support-stamp-ada.png`, then records the stamp and shows “You’re stamp #N”.
7. **Share:** “Share stamp” (Web Share with file when available), “Share on X”, “WhatsApp”, “Copy link”.

Share text: `I support @ada on show-me-love. Send a treat → {link}`.

If Web Share cannot attach files, the image is already downloaded and the buttons share the link instead.

### Entry points

- **Creator page:** compact link under the treat card — stamp icon, “Make a support stamp”, arrow. Only rendered when the campaign is active.
- **Thanks page:** on a successful payment, a card below the success card — “Keep the love going” + “Make a support stamp for @ada”. Only when active.
- **Sidebar:** “Stamps” item after “Share”.
- The dashboard share page is unchanged.

## 4. Visual design

Canvas: **1080 × 1350** (4:5).

| Style | Paper | Panel gradient | Panel ink | Panel soft |
|---|---|---|---|---|
| `honey` | `#FFF9EE` | `#F4B36A → #E96B5C → #8E3B51` | `#2B160E` | `rgba(43,22,14,.68)` |
| `cocoa` | `#F3E9DC` | `#2A221B → #171310 → #0B0907` | `#F5EEE4` | `rgba(245,238,228,.70)` |
| `sage` | `#F3FFF9` | `#9FE3D3 → #17B394 → #0E7C66` | `#06251F` | `rgba(6,37,31,.68)` |

Layout, top to bottom:

- **Perforated edge:** 16 px radius notches every 54 px on all four edges, punched with `destination-out` after drawing.
- **Inner panel:** inset 56 px, 28 px radius, palette gradient.
- **Headline:** y ≈ 150, centered, 30 px, uppercase, 10 px letter-spacing, panel-soft.
- **Photo window:** `190, 190, 700 × 700`, 24 px radius, 12 px paper border.
- **Postmark:** 150 px double circle at the photo’s top-right corner, rotated −12°, “SHOW ME / LOVE” plus the date, 35% opacity.
- **Creator name:** y ≈ 965, 64 px extrabold, fitted down to 40 px then ellipsized.
- **Handle:** y ≈ 1025, 34 px, panel-soft.
- **Supporter line:** y ≈ 1080, a pill with the supporter’s name and/or `@handle`; omitted when both are empty.
- **Bottom card:** `110, 1140, 860 × 130`, paper fill, 24 px radius; 110 px QR tile at the left; “Send a {treat}” 34 px bold and `show-me-love/@ada` 24 px to the right.

If there is no photo yet, the window shows diagonal paper stripes and “YOUR PHOTO”. The dashboard preview uses the same placeholder.

The QR is drawn from a hidden `QRCodeCanvas` (already in `qrcode.react`) into the stamp, always on a white tile for scan reliability. The creator’s own photo is **not** composited, which avoids cross-origin canvas tainting.

## 5. Data model

Add to `db/schema.sql` (idempotent):

```sql
create table if not exists stamp_campaigns (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null unique references creators(user_id) on delete cascade,
  headline text not null default 'I support',
  style text not null default 'honey' check (style in ('honey','cocoa','sage')),
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stamps (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references stamp_campaigns(id) on delete cascade,
  creator_id uuid not null references creators(user_id) on delete cascade,
  visitor_name text,
  visitor_handle text,
  created_at timestamptz not null default now()
);
create index if not exists stamps_campaign_idx on stamps(campaign_id, created_at desc);
create index if not exists stamps_creator_idx on stamps(creator_id, created_at desc);
```

No photo, IP, or user agent is stored. `creator_id` is denormalized for dashboard queries and cascades with the creator.

## 6. API

### `POST /api/stamps/campaign`

- `rejectCrossSite` + `requireUser`.
- Body: `{ headline?, style?, active? }`.
- Merge over existing campaign or defaults: headline `"I support"`, style = the creator’s page accent when valid else `honey`, active `false`.
- Validate: headline trimmed 1–40 chars; style in the enum; active boolean.
- Upsert on `creator_id`.
- Returns `{ ok: true, campaign }`.

### `POST /api/stamps`

- `rejectCrossSite`.
- Body: `{ campaignId, name?, handle? }`.
- Validate `campaignId` as a UUID.
- Rate limits before insert:
  - `stamp:ip:{ip}:{campaignId}` — 10 per hour.
  - `stamp:campaign:{campaignId}` — 300 per day.
- Campaign must exist and be active; otherwise 404.
- Sanitize:
  - name: trim, collapse whitespace, strip control chars, max 32.
  - handle: strip a leading `@`, trim, `^[A-Za-z0-9._-]{1,24}$`; empty allowed.
- Insert, count the campaign’s stamps, return `{ ok: true, count }`.
- 400 invalid input, 404 unknown/paused campaign, 429 rate limited.

### Reads

Server components call `src/lib/stamps.ts` directly; no public GET route is needed.

## 7. Library modules

### `src/lib/stamps.ts`

- `STAMP_STYLES`, `StampStyle`, `StampCampaign`, `StampStats`.
- `sanitizeStampName(value): string` and `sanitizeStampHandle(value): string`; throw `StampInputError` with user-facing messages.
- `getCampaignByCreator(creatorId)`.
- `getActiveCampaignByCreator(creatorId)`.
- `saveCampaign(creatorId, input, defaultStyle)`.
- `recordStamp({ campaignId, creatorId, name, handle })` → total count.
- `stampStats(creatorId)` → `{ total, week, recent }`.

### `src/lib/stampCanvas.ts`

- `STAMP_W`, `STAMP_H`, `STAMP_PALETTES`.
- Pure math: `coverScale`, `clampOffset`, `fitText`.
- `drawStamp(ctx, options)` with `{ style, headline, creatorName, username, treatName, supporterName, supporterHandle, photo, qr, link, date }`.
- `drawStamp` is DOM-free apart from canvas APIs; geometry is unit-tested in Node.

## 8. Routes and components

- `src/app/dashboard/stamps/page.tsx` — server page: auth, creator, campaign, stats, link; renders `StampManager`.
- `src/components/StampManager.tsx` — client editor, preview, save, QR, copy link, recent list.
- `src/components/StampPreview.tsx` — client canvas preview, reused by the manager.
- `src/app/u/[username]/stamp/page.tsx` — public server page: resolve username, active campaign, origin, treat name; `robots: noindex, follow`.
- `src/components/StampStudio.tsx` — client photo → place → sign → download/share flow.
- `src/app/api/stamps/campaign/route.ts`
- `src/app/api/stamps/route.ts`
- `src/components/Sidebar.tsx` — add Stamps.
- `src/app/u/[username]/page.tsx` — pass `stampHref` when active.
- `src/components/CreatorPage.tsx` — optional `stampHref` prop + link under `BuyCard`.
- `src/app/u/[username]/thanks/page.tsx` — load active campaign and pass `stampHref`.
- `src/components/ThanksStatus.tsx` — optional `stampHref` + success card link.
- `db/schema.sql` — two tables, two indexes.
- `tests/schema.test.ts` — add the two table names.

## 9. Privacy, safety, limits

- The photo is read with `FileReader`/`createImageBitmap` and drawn locally. It is never uploaded or sent to an API.
- Only the optional name/handle is stored, and only the creator sees it in the dashboard.
- No public gallery in v1, so there is no public display of supporter-supplied text.
- Cross-site POSTs are rejected; the campaign must be active; rate limits cap spam.
- React escapes all output; input is length-limited and handle-validated.
- Download filename: `support-stamp-{username}.png`.

## 10. Testing

- `tests/stamps.test.ts`:
  - campaign defaults, style fallback, headline trim, upsert, pause.
  - `getActiveCampaignByCreator` returns null when paused.
  - `recordStamp` inserts and returns the running count.
  - `stampStats` total/week/recent ordering.
  - name/handle sanitization and invalid handles.
  - rate-limit behavior with `hit`.
- `tests/stampCanvas.test.ts`:
  - `coverScale` covers both orientations.
  - `clampOffset` keeps the image inside the window.
  - `fitText` shrinks then ellipsizes.
- `tests/schema.test.ts`: include `stamp_campaigns` and `stamps`.
- `npm run typecheck`, `npm run test`, `npm run build`.

## 11. Rollout

- Schema is additive and idempotent; no env vars.
- Branch off `feat/warm-paper-ledger-redesign` so the Paper theme is the base.
- Verify at 1440, 390, and 320 px; screenshot the dashboard manager and the public studio.
- Open a PR against `build/show-me-love`.

## 12. Future

Custom frame uploads with a same-origin proxy and photo-window placement, multiple campaigns for events, a moderated public stamp wall, CSV export, stamp milestones, and referral attribution.
