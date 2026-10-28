import type { Sql, TransactionSql } from "postgres";

import { db } from "./db";

type Q = Sql | TransactionSql;

export type LedgerKind = "credit" | "fee" | "hold" | "release" | "reversal" | "payout";

/** Append-only. Returns false if `ref` already existed (idempotent). Accepts db() or a transaction. */
export async function addEntry(
  tx: Q,
  e: { creatorId: string; kind: LedgerKind; amountUsdt: string; ref: string },
): Promise<boolean> {
  const rows = await tx`
    insert into ledger_entries (creator_id, kind, amount_usdt, ref)
    values (${e.creatorId}, ${e.kind}, ${e.amountUsdt}, ${e.ref})
    on conflict (ref) do nothing
    returning id`;
  return rows.length > 0;
}

export async function balance(creatorId: string, tx: Q = db()): Promise<string> {
  const [r] = await tx`
    select coalesce(sum(amount_usdt), 0)::numeric(20,6)::text as v
    from ledger_entries where creator_id = ${creatorId}`;
  return r.v;
}

/** Money received net of refunds: credits (pay:, recredit:) plus the received-amount reversals (rev:, not the revfee: ones). */
export async function totalReceived(creatorId: string): Promise<string> {
  const [r] = await db()`
    select coalesce(sum(amount_usdt), 0)::numeric(20,6)::text as v
    from ledger_entries where creator_id = ${creatorId} and (kind = 'credit' or (kind = 'reversal' and ref like 'rev:%'))`;
  return r.v;
}
