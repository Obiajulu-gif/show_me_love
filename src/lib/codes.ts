import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Sql, TransactionSql } from "postgres";
import { db } from "./db";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Login: 32-byte url-safe token. Withdrawal: 6 digits. Only the sha256 is stored. */
export async function issueCode(userId: string, purpose: "login" | "withdrawal", ttlMin: number): Promise<string> {
  const code = purpose === "login" ? randomBytes(32).toString("base64url") : String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db()`
    insert into one_time_codes (user_id, purpose, code_hash, expires_at)
    values (${userId}, ${purpose}, ${sha(code)}, now() + (${ttlMin} * interval '1 minute'))`;
  return code;
}

/** Single use. userId null = look up by code alone (magic links). Returns the owner id. */
export async function consumeCode(userId: string | null, purpose: "login" | "withdrawal", code: string, q: Sql | TransactionSql = db()): Promise<string | null> {
  const [row] = await q`
    update one_time_codes set used_at = now()
    where code_hash = ${sha(String(code))} and purpose = ${purpose} and used_at is null and expires_at > now()
      and (${userId}::uuid is null or user_id = ${userId}::uuid)
    returning user_id`;
  return row?.user_id ?? null;
}
