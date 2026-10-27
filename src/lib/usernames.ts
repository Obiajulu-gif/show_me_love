import type { Sql, TransactionSql } from "postgres";

import { db } from "./db";

type Q = Sql | TransactionSql;

const RESERVED = new Set("admin api dashboard login signup docs u connect legal onboarding settings support help".split(" "));
const MSG = "3–24 letters, numbers or underscores.";

export function usernameProblem(u: string): string | null {
  if (!/^[a-z0-9_]{3,24}$/i.test(u)) return MSG;
  return RESERVED.has(u.toLowerCase()) ? "That name is reserved." : null;
}

const TAKEN = "That username is taken.";

/** `ownerId`'s own history rows don't count as taken (they may reclaim an old name). */
export async function usernameAvailable(u: string, q: Q = db(), ownerId?: string): Promise<boolean> {
  const [r] = await q`
    select (exists (select 1 from creators where username = ${u})
         or exists (select 1 from username_history where old_username = ${u} and user_id is distinct from ${ownerId ?? null})) as taken`;
  return !r.taken;
}

/**
 * Validate + reserve `name` for the rest of the transaction: advisory locks on the new (and old) name in sorted
 * order close the creators/history cross-table race. `tx` MUST be a transaction handle.
 */
export async function claimUsername(tx: Q, name: string, opts: { oldName?: string; ownerId?: string } = {}): Promise<void> {
  const problem = usernameProblem(name);
  if (problem) throw new Error(problem);
  for (const n of [name, opts.oldName].filter((x): x is string => !!x).map((x) => x.toLowerCase()).sort())
    await tx`select pg_advisory_xact_lock(hashtext(${n}))`;
  if (!(await usernameAvailable(name, tx, opts.ownerId))) throw new Error(TAKEN);
}

export async function resolveUsername(u: string): Promise<{ username: string; redirected: boolean } | null> {
  const name = u.toLowerCase();
  const [cur] = await db()`select username from creators where username = ${name}`;
  if (cur) return { username: cur.username, redirected: false };
  const [old] = await db()`
    select c.username from username_history h join creators c on c.user_id = h.user_id where h.old_username = ${name}`;
  return old ? { username: old.username, redirected: true } : null;
}

/** Old name stays reserved as a redirect; renaming back to your own old name is allowed. */
export async function renameUsername(q: Q, userId: string, newName: string): Promise<void> {
  if (!("savepoint" in q)) return void (await q.begin((tx) => renameUsername(tx, userId, newName)));
  const name = newName.toLowerCase();
  const [cur] = await q`select username from creators where user_id = ${userId} for update`;
  if (!cur) throw new Error("No creator");
  if (cur.username === name) return;
  await claimUsername(q, name, { oldName: cur.username, ownerId: userId });
  await q`delete from username_history where old_username = ${name} and user_id = ${userId}`;
  await q`insert into username_history (old_username, user_id) values (${cur.username}, ${userId}) on conflict do nothing`;
  try {
    await q`update creators set username = ${name} where user_id = ${userId}`;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new Error(TAKEN);
    throw e;
  }
}
