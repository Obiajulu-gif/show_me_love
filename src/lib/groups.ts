import type { TransactionSql } from "postgres";

import { db } from "./db";
import { attachLink, CheckoutBusy, newRef } from "./checkout";
import { parseUsernames } from "./groupNames";
import { addEntry } from "./ledger";
import { feeUsdt, ngnToUsdt, splitAmount, toMicro } from "./money";
import { getRate } from "./rates";
import { resolveUsername } from "./usernames";

/** Safe to show to the payer. */
export class GroupError extends Error {}

export { parseUsernames };
export type Currency = "NGN" | "USD";
export type GroupInput = {
  usernames: string[]; currency: Currency; total: number; split: "even" | { custom: Record<string, number> };
  message?: string; isPublic: boolean;
};

const COUNT = "Add 2–10 creators.";
const SPLIT = "Split amounts must add up to the total.";
const MAX_NGN = 10_000_000;
const MAX_RAW = 25;

type Member = { userId: string; username: string; displayName: string | null; photoUrl: string | null };

/** Current creators for these names (history resolves to the current name), deduped, input order kept. */
async function resolveMembers(names: string[]): Promise<{ found: Member[]; missing: string[] }> {
  const found: Member[] = [];
  const missing: string[] = [];
  for (const raw of names) {
    const r = /^[a-z0-9_]{3,24}$/i.test(raw) ? await resolveUsername(raw) : null;
    if (!r) { missing.push(raw); continue; }
    if (found.some((m) => m.username.toLowerCase() === r.username.toLowerCase())) continue;
    const [c] = await db()`select user_id, username, display_name, photo_url from creators where username = ${r.username}`;
    found.push({ userId: c.user_id, username: c.username, displayName: c.display_name, photoUrl: c.photo_url });
  }
  return { found, missing };
}

export async function checkGroup(names: string[]): Promise<{ ok: { username: string; displayName: string | null; photoUrl: string | null }[]; missing: string[] }> {
  const { found, missing } = await resolveMembers(names.slice(0, MAX_RAW));
  return { ok: found.map(({ username, displayName, photoUrl }) => ({ username, displayName, photoUrl })), missing };
}

/** Whole minor units (kobo/cents) of a validated amount: NGN whole naira, USD up to 2 places. */
function minor(v: unknown, currency: Currency, label: string): bigint {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new GroupError(`${label} must be more than zero.`);
  const c = Math.round(v * 100);
  if (currency === "NGN" ? !Number.isInteger(v) : Math.abs(v * 100 - c) > 1e-6) {
    throw new GroupError(currency === "NGN" ? `${label} must be a whole number of naira.` : `${label} can have at most 2 decimal places.`);
  }
  if (v > 1e9) throw new GroupError(`${label} is too large.`);
  return BigInt(c);
}
const fixed2 = (cents: bigint) => `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;

export async function startGroupCheckout(payerUserId: string, i: GroupInput, origin?: string): Promise<{ ref: string; url: string }> {
  if (!Array.isArray(i.usernames) || i.usernames.length > MAX_RAW) throw new GroupError(COUNT);
  if (i.currency !== "NGN" && i.currency !== "USD") throw new GroupError("Currency must be NGN or USD.");
  if (typeof i.isPublic !== "boolean") throw new GroupError("Something went wrong with that form. Please reload.");
  const message = i.message?.trim() || null;
  if ((message ?? "").length > 280) throw new GroupError("Message can be at most 280 characters.");

  const names = parseUsernames(i.usernames.filter((x) => typeof x === "string").join(","));
  if (names.length < 2 || names.length > 10) throw new GroupError(COUNT);
  const { found: members, missing } = await resolveMembers(names);
  if (missing.length) throw new GroupError(`We couldn't find ${missing.map((m) => `@${m}`).join(", ")}.`);
  if (members.some((m) => m.userId === payerUserId)) throw new GroupError("You can't include your own username.");
  if (members.length < 2) throw new GroupError(COUNT);
  const n = BigInt(members.length);

  const totalCents = minor(i.total, i.currency, "Total");
  const perMin = i.currency === "NGN" ? 100n : 1n;
  if (totalCents < perMin * 100n * n) {
    throw new GroupError(`Choose at least ${i.currency === "NGN" ? `₦${perMin * n}` : `$${perMin * n}`} for ${members.length} creators.`);
  }

  let shares: string[];
  if (i.split === "even") shares = splitAmount(fixed2(totalCents), members.map(() => 1));
  else {
    const custom = (i.split as { custom?: unknown })?.custom;
    if (!custom || typeof custom !== "object" || Array.isArray(custom)) throw new GroupError(SPLIT);
    const byName = new Map<string, number>();
    for (const [k, v] of Object.entries(custom)) {
      const r = /^[a-z0-9_]{3,24}$/i.test(k) ? await resolveUsername(k.replace(/^@/, "")) : null;
      if (!r || byName.has(r.username.toLowerCase())) throw new GroupError("Enter one amount for each creator in the group.");
      byName.set(r.username.toLowerCase(), v as number);
    }
    if (byName.size !== members.length) throw new GroupError("Enter one amount for each creator in the group.");
    let sum = 0n;
    shares = members.map((m) => {
      const v = byName.get(m.username.toLowerCase());
      if (v === undefined) throw new GroupError("Enter one amount for each creator in the group.");
      const c = minor(v, i.currency, "Each amount");
      sum += c;
      return fixed2(c);
    });
    if (sum !== totalCents) throw new GroupError(SPLIT);
  }

  let rate: number;
  try { rate = (await getRate()).ngnPerUsd; } catch { throw new CheckoutBusy("Prices are updating, try again in a minute."); }
  const amountNgn = i.currency === "NGN" ? Number(totalCents / 100n) : Math.ceil(Number(totalCents) * rate / 100 - 1e-9);
  if (amountNgn > MAX_NGN) throw new GroupError("That total is too large.");
  const usdt = ngnToUsdt(amountNgn, rate);
  const [u] = await db()`select email from users where id = ${payerUserId}`;
  if (!u) throw new GroupError("Sign in to support a group.");
  const email: string = u.email;

  const ref = newRef();
  const total = fixed2(totalCents);
  await db().begin(async (tx) => {
    const [g] = await tx`insert into group_payments (payer_user_id, currency, split_mode, total)
      values (${payerUserId}, ${i.currency}, ${i.split === "even" ? "even" : "custom"}, ${total}) returning id`;
    const [p] = await tx`insert into payments (ref, kind, creator_id, group_id, supporter_email, message, is_public, amount_ngn, amount_usdt, rate, status)
      values (${ref}, 'group', null, ${g.id}, ${email}, ${message}, ${i.isPublic}, ${amountNgn}, ${usdt}, ${rate}, 'pending') returning id`;
    await tx`update group_payments set payment_id = ${p.id} where id = ${g.id}`;
    for (let k = 0; k < members.length; k++) {
      await tx`insert into group_splits (group_id, creator_id, share_amount, ordinal) values (${g.id}, ${members[k].userId}, ${shares[k]}, ${k})`;
    }
  });

  const base = (origin ?? process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  return attachLink(ref, { amountNgn, name: "Supporter", email, base, successPath: `/dashboard/group?ref=${ref}&thanks=1`, cancelPath: "/dashboard/group" });
}

/** Integer weights per creator in stored order: equal for an even split, else the shares in minor units. */
export function shareWeights(mode: string, shares: string[]): number[] {
  return mode === "even" ? shares.map(() => 1) : shares.map((s) => Number(toMicro(s) / 10_000n));
}

/** Splits `received` USDT across the group's creators. The remainder goes to the first creator (ordinal 0). */
export function groupParts(mode: string, shares: string[], received: string): string[] {
  return splitAmount(received, shareWeights(mode, shares));
}

/** Credits each creator their part of the RECEIVED USDT, and charges each their own fee. Runs inside the webhook transaction. */
export async function creditGroup(tx: TransactionSql, payment: Record<string, unknown>): Promise<void> {
  const ref = String(payment.ref);
  const [g] = await tx`select split_mode from group_payments where id = ${payment.group_id as string}`;
  const rows = await tx`select creator_id, share_amount::text as share from group_splits where group_id = ${payment.group_id as string} order by ordinal, creator_id`;
  if (!g || rows.length < 2) throw new Error(`group payment ${ref} has no splits`);
  const [{ received }] = await tx`select received_usdt::text as received from payments where ref = ${ref}`;
  const parts = groupParts(g.split_mode, rows.map((r) => r.share), received);
  for (let k = 0; k < rows.length; k++) {
    const creatorId = rows[k].creator_id as string;
    const a = await addEntry(tx, { creatorId, kind: "credit", amountUsdt: parts[k], ref: `pay:${ref}:${creatorId}` });
    const b = await addEntry(tx, { creatorId, kind: "fee", amountUsdt: `-${feeUsdt(parts[k])}`, ref: `fee:${ref}:${creatorId}` });
    if (!a || !b) throw new Error(`duplicate group ledger entry for ${ref}`);
  }
}

export type GroupHistoryRow = { ref: string; status: string; total: number; currency: Currency; members: string[]; createdAt: Date };

export async function groupHistory(payerUserId: string): Promise<GroupHistoryRow[]> {
  const rows = await db()`
    select p.ref, p.status, g.total, g.currency, g.created_at,
      (select array_agg(c.username::text order by s.ordinal) from group_splits s join creators c on c.user_id = s.creator_id where s.group_id = g.id) as members
    from group_payments g join payments p on p.group_id = g.id
    where g.payer_user_id = ${payerUserId} order by g.created_at desc, p.id`;
  return rows.map((r) => ({ ref: r.ref, status: r.status, total: Number(r.total), currency: r.currency, members: r.members ?? [], createdAt: r.created_at }));
}

/** Status of this payer's own group payment, for the thanks panel. Null when it isn't theirs. */
export async function groupPaymentStatus(payerUserId: string, ref: string): Promise<{ status: string; total: number; currency: Currency } | null> {
  if (!/^[A-Z0-9]{20}$/.test(ref)) return null;
  await db()`update payments set status = 'expired' where ref = ${ref} and status = 'pending' and created_at < now() - make_interval(mins => 60)`;
  const [r] = await db()`select p.status, g.total, g.currency from payments p join group_payments g on g.id = p.group_id where p.ref = ${ref} and g.payer_user_id = ${payerUserId}`;
  return r ? { status: r.status, total: Number(r.total), currency: r.currency } : null;
}
