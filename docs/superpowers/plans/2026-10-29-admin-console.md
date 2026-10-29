# Admin console plan (2026-10-29)

Goal: admins see everything happening on the platform: who registered, money in and out, and open work.

Spec: user request in chat ("see everything happening in the platform, the users that registered, and other important activities"). No separate spec file; rulings are provisional.

Global constraints: read-only views (no schema change, so no migration for the live Neon DB); every page behind `requireAdminPage`; money shown in USDT with `.data` mono; Ledger glass tokens.

## Task 1: `src/lib/adminInsights.ts` stats + activity (TDD)
- `platformStats()`: users (total, new 7d, admins), creators (total, new 7d), payments (successful count, received USDT all time and 7d, pending, failed/expired 7d), platform fees earned, creator balances owed, withdrawals (awaiting review, processing, paid USDT), open reports.
- `activity({ limit, kinds? })`: one time-ordered feed from users, creators, payments, withdrawals, reports, connections.
- Test: `tests/adminInsights.test.ts`.

## Task 2: users list (TDD)
- `listUsers({ q, limit, offset })`: email, role, joined, username, page live, received, balance, treat count, last treat; search by email or username; newest first; `total` for paging.
- `recentPayments({ status, limit })` for the payments page when no search.
- Same test file.

## Task 3: UI
- `AdminShell` sidebar (Overview, Activity, Users, Payments, Withdrawals, Reports) with counts.
- `/admin`: stat tiles, needs-attention strip, latest activity, newest users.
- `/admin/activity`: full feed with kind filter.
- `/admin/users`: searchable, paged table.
- `/admin/payments`: recent list with status filter, search kept, refunds kept.
- Restyle withdrawals/reports headers to match.

## Task 4: verify, review, ship
- Local browser check as admin (local test account), full suite, build, self-review, commit, push, deploy.
