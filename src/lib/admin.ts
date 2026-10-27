import { notFound } from "next/navigation";

import { db } from "./db";
import { addEntry } from "./ledger";
import { requireUser, Unauthorized } from "./session";
import { dispatchUsdt, settle, WithdrawalError } from "./withdrawals";

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
    select p.ref, p.kind, p.status, p.supporter_name, p.supporter_email, p.amount_ngn, p.amount_usdt, p.received_usdt,
           p.created_at, c.username::text as username
    from payments p left join creators c on c.user_id = p.creator_id
    where p.ref = ${s} or c.username = ${s} or lower(p.supporter_email) = lower(${s})
    order by p.created_at desc limit 50`;
}
