import { db } from "./db";
import { balance, totalReceived } from "./ledger";
import { getRate } from "./rates";

export type PublicWallEntry = { id: string; name: string; message: string; quantity: number; at: Date };

/** Newest first: successful, public payments that carry a message. */
export async function publicWall(creatorId: string, limit = 20): Promise<PublicWallEntry[]> {
  const rows = await db()`
    select ref, supporter_name, message, quantity, coalesce(completed_at, created_at) as at from payments
    where creator_id = ${creatorId} and status = 'successful' and is_public and coalesce(message, '') <> ''
    order by coalesce(completed_at, created_at) desc limit ${limit}`;
  return rows.map((r) => ({ id: r.ref, name: r.supporter_name?.trim() || "Someone", message: r.message, quantity: r.quantity, at: r.at }));
}

export type PaymentRow = {
  ref: string; from: string; message: string; quantity: number; amountNgn: number; amountUsdt: string;
  status: string; kind: string; viaGroup: boolean; createdAt: Date;
};
export const FILTERS = ["successful", "pending", "expired", "failed", "refunded", "all"] as const;
export type PaymentFilter = (typeof FILTERS)[number];
export const PAGE_SIZE = 25;
const MAX_PAGE = 100000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toRow = (r: any): PaymentRow => ({
  ref: r.ref, from: r.supporter_name?.trim() || "Someone", message: r.message ?? "", quantity: r.quantity,
  amountNgn: Number(r.amount_ngn ?? 0), amountUsdt: Number(r.amount_usdt ?? 0).toFixed(2), status: r.status, kind: r.kind,
  viaGroup: r.kind === "group", // ponytail: Task 20 refines
  createdAt: r.created_at,
});

export async function listPayments(userId: string, filter: PaymentFilter, page = 1): Promise<{ rows: PaymentRow[]; count: number }> {
  const f = FILTERS.includes(filter) ? filter : "successful";
  const p = Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
  const status = f === "all" ? null : f;
  const [{ n }] = await db()`select count(*)::int as n from payments where creator_id = ${userId} and (${status}::text is null or status = ${status})`;
  const rows = await db()`select * from payments where creator_id = ${userId} and (${status}::text is null or status = ${status})
    order by created_at desc limit ${PAGE_SIZE} offset ${(p - 1) * PAGE_SIZE}`;
  return { rows: rows.map(toRow), count: n };
}

export async function overview(userId: string) {
  const [c] = await db()`select photo_url, bio, birthday from creators where user_id = ${userId}`;
  const [{ n }] = await db()`select count(*)::int as n from payments where creator_id = ${userId} and status = 'successful' and kind <> 'goal'`;
  const rate = await getRate().then((r) => r.ngnPerUsd, () => null);
  return {
    totalReceivedUsdt: await totalReceived(userId),
    balanceUsdt: await balance(userId),
    treatCount: n,
    ngnPerUsd: rate as number | null,
    setup: { page: true as const, photoBio: !!(c?.photo_url && c?.bio), birthday: !!c?.birthday },
    recent: (await listPayments(userId, "successful")).rows.slice(0, 5),
  };
}

/** Completion times of successful, public payments (any kind) since `since`, for the support heatmap. */
export async function publicTreatDates(creatorId: string, since: Date): Promise<Date[]> {
  const rows = await db()`
    select coalesce(completed_at, created_at) as at from payments
    where creator_id = ${creatorId} and status = 'successful' and is_public
      and coalesce(completed_at, created_at) >= ${since}`;
  return rows.map((r) => r.at as Date);
}
