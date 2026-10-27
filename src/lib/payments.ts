import type { JSONValue, TransactionSql } from "postgres";

import { db } from "./db";
import { addEntry } from "./ledger";
import { feeUsdt, toMicro } from "./money";
import type { RasEvent } from "./webhookCrypto";

export type Outcome = { handled: true } | { handled: false; reason: "duplicate" | "not_ours" | "bad_amount" | "unknown_event" };

/** Pending payments older than this are expired (RAS cannot requery a link by reference). */
const EXPIRY_MIN = 60;

// Task 20 builds the group split; Task 13 builds send settlement.
async function creditGroup(_tx: TransactionSql, _payment: Record<string, unknown>): Promise<void> { throw new Error("not implemented"); }
async function settleSendEvent(_event: RasEvent): Promise<Outcome> { return { handled: false, reason: "unknown_event" }; }

/** A positive decimal with at most 6 places, else null. */
function positiveUsdt(v: unknown): string | null {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^\d+(\.\d{1,6})?$/.test(s)) return null;
  return toMicro(s) > 0n ? s : null;
}

export async function handleRasEvent(event: RasEvent): Promise<Outcome> {
  const sql = db();
  const rec = await sql`
    insert into webhook_events (event_id, event_type, payload) values (${event.event_id}, ${event.event_type}, ${sql.json(event as unknown as JSONValue)})
    on conflict (event_id) do nothing returning event_id`;
  if (!rec.length) return { handled: false, reason: "duplicate" };
  try {
    return await process(event);
  } catch (e) {
    await sql`delete from webhook_events where event_id = ${event.event_id}`; // let RAS retry
    throw e;
  }
}

async function process(event: RasEvent): Promise<Outcome> {
  const type = event.event_type;
  if (type.startsWith("coin_") || type.startsWith("withdrawal")) return settleSendEvent(event);
  const done = type === "payment_link_completed" || type === "payment_link_overpaid";
  if (!done && type !== "payment_link_failed") return { handled: false, reason: "unknown_event" };

  const ref = event.meta_data?.payment_reference;
  if (typeof ref !== "string") return { handled: false, reason: "not_ours" };

  return db().begin(async (tx): Promise<Outcome> => {
    const [p] = await tx`select * from payments where ref = ${ref} for update`;
    if (!p) return { handled: false, reason: "not_ours" };

    if (!done) {
      await tx`update payments set status = 'failed', failure_reason = 'underpaid or failed' where ref = ${ref} and status = 'pending'`;
      return { handled: true };
    }
    // Late money on an expired link must still reach the creator.
    if (p.status !== "pending" && p.status !== "expired") return { handled: true };
    const received = positiveUsdt(event.meta_data.amount_received);
    if (!received) return { handled: false, reason: "bad_amount" };

    await tx`update payments set status = 'successful', completed_at = now(), received_usdt = ${received} where ref = ${ref}`;
    if (p.kind === "group") await creditGroup(tx, p);
    else {
      await addEntry(tx, { creatorId: p.creator_id, kind: "credit", amountUsdt: received, ref: `pay:${ref}` });
      await addEntry(tx, { creatorId: p.creator_id, kind: "fee", amountUsdt: `-${feeUsdt(received)}`, ref: `fee:${ref}` });
    }
    return { handled: true };
  });
}

export async function expireIfStale(ref: string): Promise<void> {
  await db()`update payments set status = 'expired'
    where ref = ${ref} and status = 'pending' and created_at < now() - make_interval(mins => ${EXPIRY_MIN})`;
}

export async function expireStale(): Promise<number> {
  const r = await db()`update payments set status = 'expired'
    where status = 'pending' and created_at < now() - make_interval(mins => ${EXPIRY_MIN}) returning ref`;
  return r.length;
}
