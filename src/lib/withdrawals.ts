import type { Sql, TransactionSql } from "postgres";

import { consumeCode } from "./codes";
import { db } from "./db";
import { sendMail } from "./email";
import { addEntry, balance } from "./ledger";
import { fromMicro, toMicro } from "./money";
import { networkFee, RasConfigError, RasFailure, sendCoin, sendStatus, type Network } from "./ras";
import { hit } from "./ratelimit";
import { getRate, RateUnavailable } from "./rates";
import type { RasEvent } from "./webhookCrypto";

type Q = Sql | TransactionSql;

/** Messages of this class are shown to the user as-is; anything else is a real failure. */
export class WithdrawalError extends Error {}
const fail = (m: string): never => { throw new WithdrawalError(m); };

export type Method = "usdt" | "ngn_bank";
export type Destination =
  | { kind: "usdt"; network: Network; address: string }
  | { kind: "bank"; bankName: string; accountNumber: string; accountName: string };

export interface Withdrawal {
  id: string; creator_id: string; method: Method; amount_usdt: string; fee_usdt: string; amount_ngn: string | null;
  destination: Record<string, unknown>; status: "awaiting_review" | "processing" | "paid" | "rejected" | "failed";
  ras_reference: string | null; created_at: Date; updated_at: Date;
}

export const BEP20 = /^0x[0-9a-fA-F]{40}$/;
export const TRC20 = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const num = (v: string | undefined, d: number) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);
const dailyCapMicro = () => toMicro(String(num(process.env.DAILY_WITHDRAW_USD, 500)));

export async function setDestination(userId: string, d: Destination): Promise<void> {
  if (d.kind === "usdt") {
    const address = String(d.address ?? "").trim();
    const ok = d.network === "bep20" ? BEP20.test(address) : d.network === "trc20" ? TRC20.test(address) : false;
    if (!ok) fail("That wallet address doesn't look right for this network.");
    const before = await getDestinations(userId);
    await db()`update creators set payout_address = ${address}, payout_network = ${d.network} where user_id = ${userId}`;
    if (before.usdt?.address !== address || before.usdt?.network !== d.network) await tellOwner(userId, maskUsdt({ network: d.network, address }));
    return;
  }
  const bankName = String(d.bankName ?? "").trim();
  const accountName = String(d.accountName ?? "").trim();
  const accountNumber = String(d.accountNumber ?? "").trim();
  if (!/^\d{10}$/.test(accountNumber)) fail("Account number must be exactly 10 digits.");
  if (bankName.length < 2 || bankName.length > 80) fail("Bank name must be 2–80 characters.");
  if (accountName.length < 2 || accountName.length > 80) fail("Account name must be 2–80 characters.");
  const before = await getDestinations(userId);
  await db()`update creators set bank = ${db().json({ bankName, accountNumber, accountName })} where user_id = ${userId}`;
  if (before.bank?.accountNumber !== accountNumber || before.bank?.bankName !== bankName) await tellOwner(userId, maskBank({ bankName, accountNumber }));
}

const maskUsdt = (u: { network: string; address: string }) => `${u.network.toUpperCase()} ${u.address.slice(0, 6)}…${u.address.slice(-4)}`;
const maskBank = (b: { bankName: string; accountNumber: string }) => `${b.bankName} ••${b.accountNumber.slice(-4)}`;

async function tellOwner(userId: string, masked: string) {
  try {
    const [u] = await db()`select email from users where id = ${userId}`;
    if (u) await sendMail(u.email, "Your payout destination was changed", `Your payout destination was changed to ${masked}. If this wasn't you, contact support.`);
  } catch { /* an email failure must not break the save */ }
}

/** Masked destination(s) for the withdrawal-code email: the chosen method's, or every one that is set. */
export async function maskedDestinations(userId: string, method?: string): Promise<string> {
  const d = await getDestinations(userId);
  const parts = [
    method !== "ngn_bank" && d.usdt ? maskUsdt(d.usdt) : "",
    method !== "usdt" && d.bank ? maskBank(d.bank) : "",
  ].filter(Boolean);
  return parts.join(" and ") || "no destination";
}

export async function getDestinations(userId: string) {
  const [c] = await db()`select payout_address, payout_network, bank from creators where user_id = ${userId}`;
  return {
    usdt: c?.payout_address ? { network: c.payout_network as Network, address: c.payout_address as string } : null,
    bank: (c?.bank ?? null) as { bankName: string; accountNumber: string; accountName: string } | null,
  };
}

export async function listWithdrawals(userId: string): Promise<Withdrawal[]> {
  return (await db()`select * from withdrawals where creator_id = ${userId} order by created_at desc limit 100`) as unknown as Withdrawal[];
}

/** Parses a positive decimal string with at most 6 places into micro-units. */
function parseAmount(s: unknown): bigint {
  const t = typeof s === "string" ? s.trim() : "";
  if (!/^\d+(\.\d{1,6})?$/.test(t) || toMicro(t) <= 0n) fail("Enter a valid amount (up to 6 decimal places).");
  return toMicro(t);
}

async function feeMicro(method: Method, network?: Network): Promise<{ fee: bigint; rate4?: bigint }> {
  if (method === "usdt") {
    if (!network) fail("Add a payout destination first.");
    return { fee: BigInt(Math.round((await networkFee(network!)) * 1e6)) };
  }
  try {
    const rate4 = BigInt(Math.round((await getRate()).ngnPerUsd * 10_000));
    const ngn = BigInt(Math.round(num(process.env.NGN_PAYOUT_FEE, 50)));
    return { fee: (ngn * 1_000_000n * 10_000n + rate4 - 1n) / rate4, rate4 };
  } catch (e) {
    if (e instanceof RateUnavailable) fail("Prices are updating, try again in a minute.");
    throw e;
  }
}

async function quoteFor(userId: string, method: Method, amount: bigint) {
  if (method !== "usdt" && method !== "ngn_bank") fail("Pick where to withdraw to.");
  const d = await getDestinations(userId);
  if (method === "usdt" ? !d.usdt : !d.bank) fail("Add a payout destination first.");
  const { fee, rate4 } = await feeMicro(method, d.usdt?.network);
  const receives = amount - fee;
  if (receives <= 0n) fail("Amount is too small to cover the fee.");
  return { fee, receives, rate4, dest: d };
}

export async function quoteWithdrawal(userId: string, method: Method, amountUsdt: string) {
  const { fee, receives, rate4 } = await quoteFor(userId, method, parseAmount(amountUsdt));
  return {
    feeUsdt: fromMicro(fee),
    receives: fromMicro(receives),
    ...(rate4 ? { receivesNgn: Number((receives * rate4) / 10_000n / 1_000_000n) } : {}),
  };
}

export async function requestWithdrawal(userId: string, i: { method: Method; amountUsdt: string; code: string }): Promise<Withdrawal> {
  const amount = parseAmount(i.amountUsdt);
  const q = await quoteFor(userId, i.method, amount);
  if (!(await hit(`wcode:${userId}`, 5, 900))) fail("Too many attempts. Try again in 15 minutes.");

  const w = await db().begin(async (tx): Promise<Withdrawal & { review: boolean }> => {
    // First statement: a refused withdrawal rolls the code back, so it is not burned.
    if (!(await consumeCode(userId, "withdrawal", String(i.code ?? ""), tx))) fail("That code is wrong or expired.");
    // The row lock serialises concurrent requests for one creator: the second sees the first's hold.
    const [c] = await tx`select payout_address, payout_network, bank from creators where user_id = ${userId} for update`;
    if (!c) fail("Add a payout destination first.");
    const destination = i.method === "usdt"
      ? c.payout_address ? { kind: "usdt", network: c.payout_network, address: c.payout_address } : null
      : c.bank ? { kind: "bank", ...c.bank } : null;
    if (!destination) fail("Add a payout destination first.");
    // The fee was quoted from the destination read before the lock; it only depends on the network.
    if (i.method === "usdt" && c.payout_network !== q.dest.usdt?.network) fail("Your payout destination changed. Check the amount and try again.");

    if (toMicro(await balance(userId, tx)) < amount) fail("Insufficient balance.");
    const [{ used }] = await tx`
      select coalesce(sum(amount_usdt), 0)::numeric(20,6)::text as used from withdrawals
      where creator_id = ${userId} and status not in ('rejected','failed')
        and created_at >= (now() at time zone 'utc')::date::timestamp at time zone 'utc'`;
    if (toMicro(used) + amount > dailyCapMicro()) fail("Daily limit reached. Try again tomorrow.");

    const [u] = await tx`select created_at > now() - interval '24 hours' as fresh from users where id = ${userId}`;
    const review = i.method === "ngn_bank" || u.fresh;
    const amountNgn = q.rate4 ? Number((q.receives * q.rate4) / 10_000n / 1_000_000n) : null;
    const [row] = await tx`
      insert into withdrawals (creator_id, method, amount_usdt, fee_usdt, amount_ngn, destination, status)
      values (${userId}, ${i.method}, ${fromMicro(amount)}, ${fromMicro(q.fee)}, ${amountNgn}, ${tx.json(destination as never)},
              'awaiting_review')
      returning *`;
    await addEntry(tx, { creatorId: userId, kind: "hold", amountUsdt: `-${fromMicro(amount)}`, ref: `hold:${row.id}` });
    return { ...(row as unknown as Withdrawal), review } as Withdrawal & { review: boolean };
  });

  const { review, ...out } = w;
  if (!review) {
    await dispatchUsdt(w.id);
    return (await db()`select * from withdrawals where id = ${w.id}`)[0] as unknown as Withdrawal;
  }
  return out;
}

export async function notifyAdmins(subject: string, text: string) {
  for (const to of (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    try { await sendMail(to, subject, text); } catch { /* never break the flow over an email */ }
  }
}

/** Moves a `processing` withdrawal to paid (marker entry) or failed (hold released). No-op from any other state. */
export async function settle(tx: Q, id: string, to: "paid" | "failed"): Promise<boolean> {
  const [w] = await tx`update withdrawals set status = ${to}, updated_at = now() where id = ${id} and status = 'processing' returning creator_id, amount_usdt`;
  if (!w) return false;
  if (to === "paid") await addEntry(tx, { creatorId: w.creator_id, kind: "payout", amountUsdt: "0", ref: `payout:${id}` });
  else await addEntry(tx, { creatorId: w.creator_id, kind: "release", amountUsdt: String(w.amount_usdt), ref: `release:${id}` });
  return true;
}

/** Sends a reviewed (or old-enough) USDT withdrawal. Only moves awaiting_review -> processing, once. */
/** Returns false when this call did not claim the withdrawal (already moved on). */
export async function dispatchUsdt(id: string): Promise<boolean> {
  const [w] = await db()`update withdrawals set status = 'processing', updated_at = now()
    where id = ${id} and status = 'awaiting_review' and method = 'usdt' returning *`;
  if (!w) return false;
  const dest = w.destination as { network: Network; address: string };
  let refid: string;
  try {
    refid = await sendCoin({ token: "usdt", network: dest.network, to: dest.address, amount: fromMicro(toMicro(w.amount_usdt) - toMicro(w.fee_usdt)) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof RasFailure || e instanceof RasConfigError) {
      // Definite: RAS refused it, or nothing was ever sent. Safe to give the money back.
      await db().begin((tx) => settle(tx, id, "failed"));
      await notifyAdmins("Withdrawal send failed", `Withdrawal ${id} was not sent and was returned to the creator's balance.\n${msg}`);
    } else {
      // Unclear (timeout, 5xx, bad body): the send may have gone through. Keep the hold.
      await flagStuck(id, `Withdrawal ${id} may or may not have been sent (${msg}). The hold is kept; reconcile with Roqqu by hand.`);
    }
    return true;
  }
  try {
    await db()`update withdrawals set ras_reference = ${refid} where id = ${id}`;
  } catch {
    await flagStuck(id, `Withdrawal ${id} was sent (RAS refid ${refid}) but saving the reference failed. The hold is kept; set ras_reference by hand.`);
  }
  return true;
}

const STUCK = "stuck alerted";
/** Emails admins once per withdrawal (admin_note marks it) about a send that needs manual reconciliation. */
async function flagStuck(id: string, text: string) {
  try { await db()`update withdrawals set admin_note = ${STUCK} where id = ${id}`; } catch { /* still alert */ }
  await notifyAdmins("Withdrawal needs reconciliation", text);
}

/** RAS `token_sent` -> paid, `token_refunded` -> failed. Runs inside the webhook's open transaction. */
export async function settleSendEvent(event: RasEvent, tx: TransactionSql): Promise<{ handled: true } | { handled: false; reason: "not_ours" | "unknown_event" }> {
  const sent = event.event_type === "token_sent";
  if (!sent && event.event_type !== "token_refunded") return { handled: false, reason: "unknown_event" };
  const ref = sent ? event.meta_data?.reference : event.meta_data?.refid;
  if (typeof ref !== "string" && typeof ref !== "number") return { handled: false, reason: "not_ours" };
  const [w] = await tx`select id from withdrawals where ras_reference = ${String(ref)} for update`;
  if (!w) return { handled: false, reason: "not_ours" };
  await settle(tx, w.id, sent ? "paid" : "failed");
  return { handled: true };
}

/** Backstop for missed webhooks: asks RAS about sends that have been processing for over 2 minutes. */
export async function pollProcessing(): Promise<number> {
  const stuck = await db()`update withdrawals set admin_note = ${STUCK}
    where status = 'processing' and ras_reference is null and updated_at < now() - interval '10 minutes'
      and admin_note is distinct from ${STUCK} returning id`;
  for (const r of stuck) await notifyAdmins("Withdrawal needs reconciliation", `Withdrawal ${r.id} has been processing for over 10 minutes with no RAS reference. Reconcile it by hand.`);
  const rows = await db()`select id, ras_reference from withdrawals
    where status = 'processing' and ras_reference is not null and updated_at < now() - interval '2 minutes'`;
  let n = 0;
  for (const r of rows) {
    let st: Awaited<ReturnType<typeof sendStatus>>;
    try { st = await sendStatus(r.ras_reference); } catch { continue; }
    if (st === "queued") continue;
    if (await db().begin((tx) => settle(tx, r.id, st === "completed" ? "paid" : "failed"))) n++;
  }
  return n;
}
