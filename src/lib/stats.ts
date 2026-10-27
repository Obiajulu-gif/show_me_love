import { db } from "./db";
import { shareWeights } from "./groups";
import { balance, totalReceived } from "./ledger";
import { splitAmount } from "./money";
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
const toRow = (r: any, group?: { usdt: string; ngn: number }): PaymentRow => ({
  ref: r.ref, from: r.supporter_name?.trim() || "Someone", message: r.message ?? "", quantity: r.quantity,
  amountNgn: group ? group.ngn : Number(r.amount_ngn ?? 0), amountUsdt: group ? group.usdt : Number(r.amount_usdt ?? 0).toFixed(2),
  status: r.status, kind: r.kind, viaGroup: !!group, createdAt: r.created_at,
});

/** Payments that are this creator's own, or group payments where they hold a split. Always scoped to `userId`. */
const mine = (userId: string) => db()`(p.creator_id = ${userId}
  or (p.kind = 'group' and exists (select 1 from group_splits s where s.group_id = p.group_id and s.creator_id = ${userId})))`;

export async function listPayments(userId: string, filter: PaymentFilter, page = 1): Promise<{ rows: PaymentRow[]; count: number }> {
  const f = FILTERS.includes(filter) ? filter : "successful";
  const p = Number.isInteger(page) && page >= 1 ? Math.min(page, MAX_PAGE) : 1;
  const status = f === "all" ? null : f;
  const [{ n }] = await db()`select count(*)::int as n from payments p where ${mine(userId)} and (${status}::text is null or p.status = ${status})`;
  const rows = await db()`select p.*, g.split_mode from payments p left join group_payments g on g.id = p.group_id
    where ${mine(userId)} and (${status}::text is null or p.status = ${status})
    order by p.created_at desc limit ${PAGE_SIZE} offset ${(p - 1) * PAGE_SIZE}`;
  const gids = rows.filter((r) => r.kind === "group").map((r) => r.group_id as string);
  const splits = gids.length
    ? await db()`select group_id, creator_id, share_amount::text as share from group_splits where group_id in ${db()(gids)} order by group_id, ordinal`
    : [];
  return {
    rows: rows.map((r) => {
      if (r.kind !== "group") return toRow(r);
      const mineSplits = splits.filter((s) => s.group_id === r.group_id);
      const k = mineSplits.findIndex((s) => s.creator_id === userId);
      const w = shareWeights(r.split_mode, mineSplits.map((s) => s.share));
      const usdt = r.status === "successful" && r.received_usdt !== null ? splitAmount(String(r.received_usdt), w)[k] : splitAmount(String(r.amount_usdt ?? "0"), w)[k];
      return toRow(r, { usdt: Number(usdt).toFixed(2), ngn: Math.round(Number(splitAmount(String(r.amount_ngn ?? "0"), w)[k])) });
    }),
    count: n,
  };
}

export async function overview(userId: string) {
  const [c] = await db()`select photo_url, bio, birthday from creators where user_id = ${userId}`;
  const [{ n }] = await db()`select count(*)::int as n from payments p where ${mine(userId)} and p.status = 'successful' and p.kind <> 'goal'`;
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
