import { randomUUID } from "node:crypto";

import { notFound } from "next/navigation";

import { db } from "./db";
import { addEntry } from "./ledger";
import { fromMicro, toMicro } from "./money";
import { networkFee, RasConfigError, RasFailure, sendCoin } from "./ras";
import { requireUser, Unauthorized } from "./session";
import { BEP20, dispatchUsdt, notifyAdmins, restoreRefund, settle, TRC20, WithdrawalError } from "./withdrawals";

export class Forbidden extends Error {
  constructor() { super("Admins only."); }
}

export async function requireAdmin(): Promise<{ id: string }> {
  const u = await requireUser();
  if (u.role !== "admin") throw new Forbidden();
  return { id: u.id };
}

/** For pages: logged-out users and non-admins both get a 404. */
export async function requireAdminPage(): Promise<{ id: string }> {
  try { return await requireAdmin(); } catch (e) {
    if (e instanceof Forbidden || e instanceof Unauthorized) notFound();
    throw e;
  }
}

/** Library functions re-check the role themselves so they are safe to call from anywhere. */
async function assertAdmin(adminId: string) {
  const [u] = await db()`select 1 from users where id = ${adminId} and role = 'admin'`;
  if (!u) throw new Forbidden();
}

const NOT_REVIEW = "Not awaiting review.";
const NOT_STUCK = "Not stuck in sending.";
const need = (v: unknown, msg: string): string => {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) throw new WithdrawalError(msg);
  return s;
};

export async function approveWithdrawal(adminId: string, id: string): Promise<void> {
  await assertAdmin(adminId);
  if (!(await dispatchUsdt(id))) throw new WithdrawalError(NOT_REVIEW);
}

export async function markNgnPaid(adminId: string, id: string, bankReference: string): Promise<void> {
  await assertAdmin(adminId);
  const ref = need(bankReference, "Enter the bank transfer reference.");
  const ok = await db().begin(async (tx) => {
    const [w] = await tx`update withdrawals set status = 'paid', bank_reference = ${ref}, updated_at = now()
      where id = ${id} and status = 'awaiting_review' and method = 'ngn_bank' returning creator_id`;
    if (!w) return false;
    await addEntry(tx, { creatorId: w.creator_id, kind: "payout", amountUsdt: "0", ref: `payout:${id}` });
    return true;
  });
  if (!ok) throw new WithdrawalError(NOT_REVIEW);
}

export async function rejectWithdrawal(adminId: string, id: string, note: string): Promise<void> {
  await assertAdmin(adminId);
  const n = need(note, "Say why you are rejecting it.");
  const ok = await db().begin(async (tx) => {
    const [w] = await tx`update withdrawals set status = 'rejected', admin_note = ${n}, updated_at = now()
      where id = ${id} and status = 'awaiting_review' returning creator_id, amount_usdt`;
    if (!w) return false;
    await addEntry(tx, { creatorId: w.creator_id, kind: "release", amountUsdt: String(w.amount_usdt), ref: `release:${id}` });
    return true;
  });
  if (!ok) throw new WithdrawalError(NOT_REVIEW);
}

/** Stuck sends: reuse settle()'s transition (processing -> paid | failed) and record the admin's note. */
async function resolveStuck(adminId: string, id: string, note: string, to: "paid" | "failed") {
  await assertAdmin(adminId);
  const n = need(note, "A note is required (what did you check?).");
  const ok = await db().begin(async (tx) => {
    // Only sends the reconciler flagged: a plain in-flight `processing` row may still complete.
    const [stuck] = await tx`select 1 from withdrawals where id = ${id} and status = 'processing' and admin_note = 'stuck alerted' for update`;
    if (!stuck || !(await settle(tx, id, to))) return false;
    await tx`update withdrawals set admin_note = ${n} where id = ${id}`;
    return true;
  });
  if (!ok) throw new WithdrawalError(NOT_STUCK);
}
export const resolveStuckPaid = (adminId: string, id: string, note: string) => resolveStuck(adminId, id, note, "paid");
export const resolveStuckRelease = (adminId: string, id: string, note: string) => resolveStuck(adminId, id, note, "failed");

export interface QueueRow {
  id: string; method: string; status: string; amount_usdt: string; fee_usdt: string; amount_ngn: string | null;
  destination: Record<string, string>; admin_note: string | null; created_at: Date; username: string; email: string;
}

/** Awaiting-review withdrawals plus sends flagged as stuck, oldest first. */
export async function listQueue(): Promise<QueueRow[]> {
  return (await db()`
    select w.id, w.method, w.status, w.amount_usdt::text, w.fee_usdt::text, w.amount_ngn::text, w.destination, w.admin_note,
           w.created_at, c.username::text as username, u.email::text as email
    from withdrawals w join creators c on c.user_id = w.creator_id join users u on u.id = w.creator_id
    where w.status = 'awaiting_review' or (w.status = 'processing' and w.admin_note = 'stuck alerted')
    order by w.created_at limit 200`) as unknown as QueueRow[];
}

/** Exact ref, creator username or supporter email (case-insensitive); 50 rows max. `q` is always a bound parameter. */
export async function searchPayments(q: string) {
  const s = (q ?? "").trim();
  if (!s) return [];
  return await db()`
    select p.ref, p.kind, p.status, p.supporter_name, p.supporter_email, p.amount_ngn, p.amount_usdt, p.received_usdt, p.refund_address,
           p.created_at, c.username::text as username
    from payments p left join creators c on c.user_id = p.creator_id
    where p.ref = ${s} or c.username = ${s} or lower(p.supporter_email) = lower(${s})
    order by p.created_at desc limit 50`;
}

export async function resolveReport(adminId: string, id: string): Promise<void> {
  await assertAdmin(adminId);
  const r = await db()`update reports set resolved_at = now() where id = ${id} and resolved_at is null returning id`;
  if (!r.length) throw new WithdrawalError("Report not found or already resolved.");
}

export async function listOpenReports() {
  return await db()`select id, username, reason, details, reporter_email, created_at from reports where resolved_at is null order by created_at desc limit 200`;
}

const OK_ONLY = "Only successful payments can be refunded.";

/**
 * Refunds a successful payment as a NEW USDT send to the supporter (Roqqu's refund endpoint only reverses sends).
 * Ledger reversal is committed first; a definite RAS failure restores it, an unclear one leaves it and alerts admins.
 */
export async function refundPayment(adminId: string, ref: string, to: { address: string; network: string }): Promise<{ outcome: "sent" | "unclear" }> {
  await assertAdmin(adminId);
  const network = to.network;
  const address = String(to.address ?? "").trim();
  if (network !== "bep20" && network !== "trc20") throw new WithdrawalError("Pick a network.");
  if (!(network === "bep20" ? BEP20 : TRC20).test(address)) throw new WithdrawalError("That wallet address doesn't look right for this network.");

  const [p] = await db()`select creator_id, received_usdt::text as received, status from payments where ref = ${ref}`;
  if (!p || p.status !== "successful" || !p.creator_id || p.received === null) throw new WithdrawalError(OK_ONLY);
  const received: string = p.received;
  const amountMicro = toMicro(received) - BigInt(Math.round((await networkFee(network)) * 1e6));
  if (amountMicro <= 0n) throw new WithdrawalError("Payment is too small to refund after network fees.");

  const attempt = randomUUID();
  await db().begin(async (tx) => {
    const [u] = await tx`update payments set status = 'refunded', refund_address = ${address}, refund_network = ${network}
      where ref = ${ref} and status = 'successful' returning creator_id`;
    if (!u) throw new WithdrawalError(OK_ONLY);
    const [f] = await tx`select (-amount_usdt)::text as v from ledger_entries where ref = ${`fee:${ref}`}`;
    // Refs are unique per attempt: a retry after a restored failure must debit again.
    const a = await addEntry(tx, { creatorId: u.creator_id, kind: "reversal", amountUsdt: `-${received}`, ref: `rev:${ref}:${attempt}` });
    const b = await addEntry(tx, { creatorId: u.creator_id, kind: "reversal", amountUsdt: f?.v ?? "0", ref: `revfee:${ref}:${attempt}` });
    if (!a || !b) throw new Error("duplicate refund ledger ref");
  });

  try {
    const refid = await sendCoin({ token: "usdt", network, to: address, amount: fromMicro(amountMicro) });
    await db()`update payments set refund_reference = ${refid} where ref = ${ref}`;
    return { outcome: "sent" };
  } catch (e) {
    if (e instanceof RasFailure || e instanceof RasConfigError) {
      try {
        await db().begin((tx) => restoreRefund(tx, ref));
      } catch (re) {
        await notifyAdmins("Refund restore failed", `Refund of payment ${ref} was refused by Roqqu, but restoring the creator's balance failed: ${(re as Error).message}. The payment is still marked refunded and nothing was sent. Fix by hand.`);
        throw new WithdrawalError("Roqqu refused the refund and the balance could not be restored automatically. Admins have been emailed.");
      }
      throw new WithdrawalError(`Roqqu refused the refund: ${(e as Error).message}`);
    }
    await notifyAdmins("Refund needs checking", `Refund of payment ${ref} (${fromMicro(amountMicro)} USDT to ${network} ${address}) had an unclear outcome. Verify on-chain / in Roqqu before retrying.`);
    return { outcome: "unclear" };
  }
}
