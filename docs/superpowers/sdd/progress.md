# SDD ledger — plan: docs/superpowers/plans/2026-10-26-show-me-love.md

Spec: docs/superpowers/specs/2026-10-26-show-me-love-design.md
Branch: build/show-me-love (from main @ 8e54072)

## Preflight scan

| Pair / task | Produces vs consumes | Finding |
|---|---|---|
| T2 ↔ T3 | T2 copies ras.ts with ngnPerUsd env fallback; T3 says remove fallback but ras.ts not in T3 Files | Conflict (file list). Ruling below |
| T10 ↔ T11 | T10 paymentStatus calls expireIfStale, defined in T11 (later) | Ordering conflict. Ruling below |
| T11 ↔ T13 | settleSendEvent stub in T11, real in T13; pollProcessing added to T11 cron | OK |
| T11 ↔ T20 | creditGroup stub in T11, real in T20 | OK |
| T11 ↔ T16 | received_usdt column added T11, used for USD goal progress T16 | OK |
| T13 ↔ T14 | dispatchUsdt, release/payout entries | OK |
| T12 ↔ T20 | PaymentRow.viaGroup set in T20 | OK |
| T7 ↔ T8 | creators.ts create then update; Creator type | OK |
| T6 ↔ T8 | renameUsername(tx, userId, newName) | OK |
| T8 ↔ T9/T18 | CreatorPage shared; heatmap added T18 | OK |
| T5 ↔ T6/T10/T19/T22 | hit(key, limit, windowSec) | OK |
| T17 ↔ T22 | Connected apps tab placeholder then real | OK |
| T2 ↔ T19 | refundTransaction | OK |
| T13 ↔ T15 | smoke uses dev hint code when email unset | OK (email.ts devHint) |
| T1 self | test asserts ≥10 top-level catalog items; seed lists 9 | Conflict. Ruling below |
| T3 self | ngnToUsdt(500,1500)="0.34"; split 10/3 remainder | Consistent |
| T11 self | 1.00 credit, 5% fee → 0.95 | Consistent |
| T13 self | 10 − hold 4 → 6 | Consistent |
| T18 self | 2026-10-26 is Monday | Verified |
| T19 self | 0.95 − 1.00 + 0.05 = 0 | Consistent |
| T15 self | push to GitHub + vercel --prod are outward-facing | Ruling below |
| Other tasks | tests vs code vs files | Self-consistent |

## Rulings

- Ruling: T3 may edit src/lib/ras.ts so ngnPerUsd() throws instead of using ROQQU_NGN_PER_USD — plan text says remove fallback; spec §9 says never guess a price — if wrong, checkout blocks when /rates is briefly down (stale 10-min cache softens it).
- Ruling: T10 paymentStatus does not call expireIfStale; T11 adds that call — expireIfStale doesn't exist until T11 — if wrong, nothing (T11 closes the gap).
- Ruling: T1 seed adds a 10th top-level treat `chapman` (category treat) — test requires ≥10 and spec wants parity with ~10 tiles — if wrong, one extra tile on the picker.
- Ruling: T15 steps 3–4 (git push to new GitHub repo, vercel deploy --prod, RAS webhook registration) are deferred to the end and asked of the user; T15 runs the smoke locally only — push/publish need the user's OK per SDD stop rules — if wrong, deploy happens a few days later than planned.
- Ruling: work happens on branch build/show-me-love in the main checkout, not a worktree — fresh repo with only docs, nothing else on main to protect — if wrong, nothing (merge is fast-forward).

## Progress
Task 1: implemented 0970b7e (base 8e54072), in review
Task 1: minor (deferred): db.ts DbMissing message/comment still says "business database"
Task 1: minor (deferred): schema test doesn't assert child counts / unique constraints
Task 1: minor (deferred): "Glucose D" display name near a brand; tailwind sans has no fallback fonts
Task 1: minor (deferred): vitest CJS config warning noise (rename to vitest.config.mts)
Task 1: complete (commits 8e54072..0970b7e, review clean)
Task 2: first implementer stalled (600s watchdog), no commits; controller read RAS docs and re-dispatches with exact paths
- Ruling: requeryPayment becomes requeryTx(network, txHash) → POST /transaction/requery/:network {tx_hash}; RAS cannot requery a payment link by reference, so expiry (T11) marks pending >60 min expired without requery, and a late completed webhook still credits a payment in `expired` status — docs show requery needs a tx hash — if wrong, an expired-then-paid row is credited (correct money outcome).
- Ruling: RAS /transaction/refund refunds a send (refid), not a payment link. T19 refundPayment = admin enters supporter's USDT address + network; we sendCoin the received amount back, then reversal entries; status refunded — docs — if wrong, refunds cost a network fee the platform absorbs.
- Ruling: sendStatus(refid) → GET /transaction/refId/:refid — docs.
Task 2: implemented dba0e9d (base 0970b7e), in review
- Ruling: Task 2 reviewer minors "sendStatus regex matches unsuccessful/incomplete" and "sendCoin empty refid" are raised to Important and enter the fix loop — both can mark a payout paid or untrackable (real money) — if wrong, a few extra lines of fix work.
Task 2: minor (deferred): networkFee missing fee → 0 silently under-quotes
Task 2: fix round 1/5 implemented (commits dba0e9d..e1c672e), in re-review
Task 2: fix round 1/5 (3 addressed, 1 open — non-JSON 200/4xx body becomes RasFailure via fallback; commits dba0e9d..e1c672e)
Task 2: fix round 2/5 (1 addressed, 0 open; commits e1c672e..efb510a)
Task 2: minor (deferred): non-JSON test asserts message substring, not error class
Task 2: complete (commits 0970b7e..efb510a, review clean)
Task 3: implemented f2c5b76 (base efb510a), in review
Task 3: minor (deferred): money input hardening — ngnToUsdt accepts fractional/unsafe ints; splitAmount negative/zero/non-int weights; PLATFORM_FEE_BPS ""/NaN not validated; getRate no isFinite check; no in-flight dedupe; no zero/large/invalid input tests
Task 3: complete (commits efb510a..f2c5b76, review clean)
Task 4: implemented 3b6f1d7 (base f2c5b76), in review
Task 4: minor (deferred): totalReceived lacks tx param
Task 4: complete (commits f2c5b76..3b6f1d7, review clean)
Task 5: implemented e8bbe3c (base 3b6f1d7), in review; implementer resumed after weekly rate limit, no RED captured
- Ruling: Task 5 minor "email.ts logs full body incl. magic link in production when no provider" raised to Important — leaks a login credential to logs — if wrong, a one-line extra fix.
- Ruling: clientIp prefers `x-vercel-forwarded-for`, then `x-real-ip`, then the LAST `x-forwarded-for` hop, then "local" — deploy target is Vercel — if wrong behind another proxy, rate limits key on the proxy IP (stricter, not bypassable).
- Ruling (carry to Task 13): withdrawal 6-digit code needs an attempt limit (hit() 5 per 15 min per user) — reviewer note — if skipped, code brute-forceable.
Task 5: minor (deferred): PUBLIC_APP_URL unset → relative magic link; magic timing side channel; /login?error=link not shown; login drops treat/username; AuthForm busy not reset on network error; rate_limits never pruned; fixed-window burst; codes test doesn't prove sha256 stored
Task 5: fix round 1/5 implemented (commits e8bbe3c..d388dbb), in re-review
Task 5: fix round 1/5 (4 addressed, 0 open; commits e8bbe3c..d388dbb); controller verified ⚠️ items: session key matches test key, tsc clean, session+auth tests 8/8
Task 5: minor (deferred): x-real-ip/x-vercel-forwarded-for spoofable off Vercel (document); prod with no email provider drops codes silently — callers must surface sent:false; session test env stub not in try/finally
Task 5: complete (commits 3b6f1d7..d388dbb, review clean)
Task 6: implemented 15e82b6 (base d388dbb), in review
Task 6: minor (deferred): usernameAvailable doesn't lowercase (relies on citext); catalog test hard-codes 10; no route-handler/429/mixed-case rename tests
- Ruling (carry to Task 7): createCreator must use the same username claim helper (advisory lock on hashtext(lower(name)) + 23505 → "That username is taken.") — same race as renameUsername — if skipped, raw DB error on concurrent signup.
Task 6: fix round 1/5 implemented (commits 15e82b6..378f469), in re-review
Task 6: fix round 1/5 (2 addressed, 0 open; commits 15e82b6..378f469)
Task 6: minor (deferred): 23505 branch not exercised (1-connection test pool); claimUsername doesn't lowercase for availability check (callers must)
Task 6: complete (commits d388dbb..378f469, review clean)
- Ruling: Task 7 landing copy must be original; the plan's headline "Your good work deserves a little love." echoes buymeamalt's hero line, so use "Make it easy for your people to show you love." with a cocoa-2 second line "One link. Local treats. Paid in USDT." — spec §1 says never copy their copy — if wrong, the user can swap a headline string.
Task 7: implemented 174d045 (base 378f469), in review
Task 7: minor (deferred): onboarding route matches errors by message regex; no 401/invalid-JSON route tests; popover lacks aria-expanded/Escape/outside-click and can overflow on mobile right column; catalog fetch failure silent; claim/onboarding not <form> (Enter); Button default type; landing custom treat not carried
Task 7: fix round 1/5 implemented (commits 174d045..ce080da), in re-review
Task 7: fix round 1/5 (1 addressed, 0 open; commits 174d045..ce080da)
Task 7: minor (deferred): custom treat name/emoji not trimmed on insert; TAKEN const spacing
Task 7: complete (commits 378f469..ce080da, review clean)
Task 8: implemented 9e7df0b (base ce080da), in review
Task 8: controller resolved ⚠️: renameUsername is a no-op for unchanged name (usernames.ts:52); FRIENDLY regex covers usernames.ts messages
- Ruling: upload cap is 4 MB for both avatar and cover (spec said 10/5 MB) — Vercel serverless request bodies cap at ~4.5 MB so larger limits would fail with a platform error — if wrong, creators can't upload 4–10 MB photos (they can resize).
Task 8: minor (deferred): validate typeof bio/thank_you + birthday date parse + page_style key whitelist; no PATCH route whitelist test; boundary tests; tabs/drawer a11y (aria, Escape, focus trap); file input not reset; upload fetch error unhandled; save bar offset when sidebar collapsed; pages assume session; wall key=name collisions (key on payment id); photo URLs any https host
Task 8: fix round 1/5 implemented (commits 9e7df0b..d6bc72a), in re-review
Task 8: fix round 1/5 (3 addressed, 0 open; commits 9e7df0b..d6bc72a)
Task 8: minor (deferred): PNG test rm not in finally; social URLs not trimmed before store
Task 8: complete (commits ce080da..d6bc72a, review clean)
- Ruling: several plan strings echo buymeamalt's own copy ("This corner is still unclaimed.", "A little wall of encouragement", "A little love goes a long way. Be the first to show your support.", footer tagline "A little love goes a long way."). Replace with original strings: 404 "No page lives here yet." / "Claim this name before someone else does."; wall heading "Notes from supporters"; wall empty "No notes yet. Yours could be the first."; footer tagline "Small treats, real support." — spec §1 forbids copying their copy — if wrong, string swaps only. Applies to every later task too.
Task 9: implemented ee7c6d4 (base d6bc72a), in review
Task 9: controller resolved ⚠️ tsc narrowing: implementer reported typecheck+build green
Task 9: minor (deferred): /@Ada not canonicalised to /@ada; whitespace-only messages pass wall filter; getCreatorByUsername(...)! non-null assertion; no middleware/308 test
Task 9: fix round 1/5 implemented (commits ee7c6d4..a7f0cd6), in re-review
Task 9: fix round 1/5 (1 addressed, 0 open; commits ee7c6d4..a7f0cd6)
Task 9: complete (commits d6bc72a..a7f0cd6, review clean)
- Ruling: BuyCard button copy "Buy my next {treat} ₦X" echoes buymeamalt; use "Send {treat} · ₦{total}" and footer line "Paid securely in USDT via Roqqu" — copy rule — if wrong, string swap.
Task 10: implemented 0f21cc6 (base a7f0cd6), in review
Task 10: minor (deferred): link_url update inside RAS try (misleading failure_reason; catch update can mask CheckoutBusy); client redirect url unguarded; custom amount stored qty=1 (wall wording); ThanksStatus polling stop hint, simulate() no catch, refunded copy; test gaps (ceil rounding, payment_link non-null, MAX_NGN); double-Enter ref guard; BuyCard onSend dead
Task 10: fix round 1/5 implemented (commits 0f21cc6..53af646), in re-review
Task 10: fix round 1/5 (1 addressed, 0 open; commits 0f21cc6..53af646)
Task 10: minor (deferred): checkout-route test RAS_MODE stub not cleaned; IP coupling between tests
Task 10: complete (commits a7f0cd6..53af646, review clean)
Task 11: implemented 9139aef (base 53af646), in review
- Ruling (all later dispatches): never stop servers with `taskkill /IM node.exe` (Task 11 implementer did, killing every node process on the machine); record the PIDs you start and stop only those — side effect outside the worktree — if ignored, user's other node apps/MCP servers die.
- Ruling: Task 11 minors #1 (missing event_id → poison 500 retried forever) and #2 (failed compensating delete loses a credit) raised to Important — both can leave a supporter's real payment uncredited — fix: validate event_id; record webhook_events inside the same transaction as the payment update so failure rolls both back — if wrong, a little extra work.
Task 11: minor (deferred): no amount_received sanity cap vs amount_usdt; overpaid-after-completed drops extra (confirm RAS semantics); cron secret compare not timing-safe; untested 500/delete path and 1e3/7-decimal inputs; missing RAS key silently enables /api/dev/simulate (practice) — consider refusing practice when NODE_ENV=production && RAS_MODE unset
Task 11: fix round 1/5 implemented (commits 9139aef..ac0e168), in re-review
Task 11: fix round 1/5 (2 addressed, 0 open; commits 9139aef..ac0e168)
- Ruling (carry to Task 13): settleSendEvent must take the webhook transaction `tx` (called inside handleRasEvent's sql.begin) — re-review note — if skipped, send settlement is not atomic with the event record.
Task 11: complete (commits 53af646..ac0e168, review clean)
Task 12: implemented 0a09490 (base ac0e168), in review; browser check was HTTP-only, not a real browser
Task 12: minor (deferred): overview recent runs extra count(*); sequential queries (Promise.all); missing tests (invalid filter/page, other creator excluded, ≈₦ math, 25-row boundary); no visual check
Task 12: fix round 1/5 implemented (commits 0a09490..397992b), in re-review
Task 12: fix round 1/5 (2 addressed, 0 open; commits 0a09490..397992b)
Task 12: minor (deferred): treats page hardcodes 100000 instead of importing MAX_PAGE
Task 12: complete (commits ac0e168..397992b, review clean)
- Ruling: RAS send events are `token_sent` (meta_data.reference = send refid, status "processed") and `token_refunded` (meta_data.refid); not "coin_*"/"withdrawal*". Task 13 changes handleRasEvent's dispatch to route those two types to settleSendEvent(event, tx): token_sent → withdrawal paid (payout marker), token_refunded → failed + release. Other coin events (token_received etc.) → unknown_event — from RAS coin-webhook docs — if wrong, payouts settle only via pollProcessing.
Task 13: implemented 320f4a9 (base 397992b), in review; no true RED (lock-removal mutation used)
Task 13: reviewer "chip labels differ" — not a defect: controller ruling set "In review"/"Sending" (original copy).
- Ruling: Task 13 destination-change risk fixed by putting the masked destination in the code email AND emailing the owner on every destination change (not by binding codes to a destination hash) — cheapest of the reviewer's options — if wrong, a hijacked session + timing could still redirect one payout the owner was warned about.
- Ruling: Task 13 minor #5 (fee from pre-lock destination network) raised to Important — wrong network fee under-charges the platform on real sends — if wrong, a few lines of extra work.
Task 13: minor (deferred): concurrency tests on 1-connection pool prove little; failed send returns ok:true silently in UI; dailyCapMicro env parsing via Number
Task 13: fix round 1/5 implemented (commits 320f4a9..2982120), in re-review
Task 13: fix round 1/5 (5 addressed, 0 open; commits 320f4a9..2982120)
Task 13: minor (deferred): code not bound to method (email may show USDT dest while payout goes bank); stuck alert marked before email sent; flagStuck overwrites admin_note; notifyAdmins throw propagates to user request
- Ruling (carry to Task 14): admin queue also lists `processing` withdrawals flagged "stuck alerted" with a "Mark paid (verified on-chain)" and "Release hold (verified not sent)" action — otherwise stuck holds have no UI to resolve — if wrong, admins reconcile via SQL.
Task 13: complete (commits 397992b..2982120, review clean)
Task 14: implemented 1d5b7cc (base 2982120), in review
- Ruling: Task 14 minor "admin POST has no Origin check" raised to Important — admin actions release/send real money and SameSite=Lax alone leaves sibling-subdomain risk — fix: reject when Origin present and not same-origin (PUBLIC_APP_URL or request origin), require application/json — if wrong, one helper of extra code.
Task 14: minor (deferred): approve returns success when send stuck/failed; no admin audit trail; no sendCoin-once assertion on double approve; crash between claim and send leaves unmarked processing row (pollProcessing only alerts null-ref rows after 10 min — check it covers this)
Task 14: fix round 1/5 implemented (commits 1d5b7cc..11375b5), in re-review
Task 14: fix round 1/5 (2 addressed, 0 open; commits 1d5b7cc..11375b5)
Task 14: minor (deferred): content-type check case-sensitive
Task 14: complete (commits 2982120..11375b5, review clean)
Task 15: implemented c396cce (base 11375b5), in review; smoke OK x2; 3 app bugs fixed (admin content-type, withdraw blur, practice /rates)
Task 15: minor (deferred): practice ngnPerUsd still calls /rates before 1500 fallback (skip call in practice); seed idempotency relies on public page rendering notes; smoke text selectors loose
Task 15: complete (commits 11375b5..c396cce, review clean)
PAUSED: usage limit reached after Task 15. Resume at Task 16 (Tier 2). Deploy (push/Vercel/Neon/RAS webhook) still awaits user approval.
RESUMED: Task 16 dispatch
Task 16: implemented 50b6ba7 (base c396cce), in review; one admin.test flake during parallel build
Task 16: minor (deferred): suggested min not enforced; coverUrl/organizerPhoto any string; goalPaymentStatus expires before ownership check; dashboard creator ! crash; no checkout-route/slug -3/two-first-checkout tests; no goal delete (brief silent)
Task 16: fix round 1/5 implemented (commits 50b6ba7..945ec2f), in re-review
Task 16: fix round 1/5 (3 addressed, 0 open; commits 50b6ba7..945ec2f)
Task 16: minor (deferred): invalid-amount request still locks goal currency (lock precedes amount validation)
Task 16: complete (commits c396cce..945ec2f, review clean)
- Ruling: Task 17 embed/QR button copy "Buy me some {treat}" echoes buymeamalt; use "Send me a {treat}" and QR pill "Scan to send love" — copy rule — if wrong, string swaps.
Task 17: implemented c17c8de (base 945ec2f), in review
Task 17: minor (deferred): tabs role=tablist without panels (use nav + aria-current); "Copied" not announced; MessageEditor.save no try/catch; empty origin fallback; empty share message leading newline; creator ! on share page; no PATCH route test for share_message
Task 17: complete (commits 945ec2f..c17c8de, review clean)
- Ruling: Task 18 heatmap copy in the plan echoes buymeamalt ("Wall of love", "12 weeks of little thank-yous", "No public treats on this day.", "Your first treat will light up this space.", "Public treats · UTC"). Use: heading "Recent support", sub "The last 12 weeks", tooltip "No treats this day." / "1 treat" / "n treats", empty "Treats will show up here.", footer "Days shown in UTC", legend "Fewer"/"More" — copy rule — if wrong, string swaps.
Task 18: implemented 464f9a8 (base c17c8de), in review
- Ruling: revise Task 18 ruling "focusable cells": the grid becomes ONE tab stop (role="grid"/roving tabindex, arrow keys move between days, tooltip shown for the focused day) instead of 84 tab stops — 84 stops before footer links harms keyboard users — if wrong, a small client component of extra code.
Task 18: minor (deferred): duplicate month labels at col 0; aria-label span roles (resolved by roving grid); stats test date filter fragile Oct 1-9; no oldest-grid-day boundary test; Sept label width
Task 18: fix round 1/5 implemented (commits 464f9a8..689a36a), in re-review
Task 18: fix round 1/5 (3 addressed, 0 open; commits 464f9a8..689a36a); controller: findLastIndex fine (typecheck green)
Task 18: minor (deferred): heatmap keys intercepted with modifiers; today computed on client (midnight hydration mismatch)
Task 18: complete (commits c17c8de..689a36a, review clean)
- Ruling: Task 19 refund flow (sends real USDT back to the supporter): admin enters supporter's USDT address + network; in ONE tx conditional update successful→refunded + `reversal` -received (ref rev:<ref>) + `reversal` +fee (ref revfee:<ref>) + store refund_address/network; after commit sendCoin(received − network fee, platform absorbs nothing beyond that); definite RasFailure/RasConfigError → in tx restore successful + `credit` +received (recredit:<ref>) + `fee` -fee (refee:<ref>); unclear error → stay refunded, store refid if any, email admins. New payments columns added idempotently — same safety model as withdrawals — if wrong, refund semantics need a small redesign.
Task 19: implemented 51f2f95 (base 689a36a), in review; group refunds refused for now
- Ruling: Task 19 minor #5 (live networkFee missing → 0 → full amount sent) raised to Important; fix in ras.ts networkFee (throw RasError when fee not finite > 0) so withdrawals and refunds both benefit — sends real USDT — if wrong, small extra work.
Task 19: minor (deferred): refid lost if refund_reference save fails (include refid in admin email); group refund message misleading; report body size unbounded, nonexistent usernames accepted; ResolveReportButton ignores non-OK; RefundForm busy stuck on network error; no concurrent double-refund test; negative balance not shown in admin
Task 19: fix round 1/5 implemented (commits 51f2f95..dfb9a1d), in re-review
Task 19: fix round 1/5 (4 addressed, 0 open; commits 51f2f95..dfb9a1d)
Task 19: minor (deferred): RasError from networkFee surfaces as 500 (map to friendly); token_refunded before refund_reference saved is dropped; bounce email sent inside tx (could precede rollback)
Task 19: complete (commits 689a36a..dfb9a1d, review clean)
TIER 2 COMPLETE.
- Ruling: Task 20 copy original — do not use "Who are we treating?" or "Your group starts with a username." (other site's wording); write own strings.
Task 20: implementer stopped mid-task for move to cloud; WIP committed as-is (unreviewed, may not pass tests)
