import type { Sql, TransactionSql } from "postgres";

import { db } from "./db";

type Q = Sql | TransactionSql;

const RESERVED = new Set("admin api dashboard login signup docs u connect legal onboarding settings support help".split(" "));
const MSG = "3–24 letters, numbers or underscores.";

export function usernameProblem(u: string): string | null {
  if (!/^[a-z0-9_]{3,24}$/i.test(u)) return MSG;
  return RESERVED.has(u.toLowerCase()) ? "That name is reserved." : null;
}

export async function usernameAvailable(u: string, q: Q = db()): Promise<boolean> {
  const [r] = await q`
    select (exists (select 1 from creators where username = ${u})
         or exists (select 1 from username_history where old_username = ${u})) as taken`;
  return !r.taken;
}

export async function resolveUsername(u: string): Promise<{ username: string; redirected: boolean } | null> {
  const name = u.toLowerCase();
  const [cur] = await db()`select username from creators where username = ${name}`;
  if (cur) return { username: cur.username, redirected: false };
  const [old] = await db()`
    select c.username from username_history h join creators c on c.user_id = h.user_id where h.old_username = ${name}`;
  return old ? { username: old.username, redirected: true } : null;
}

/** Call inside a transaction. Old name stays reserved as a redirect; renaming back to your own old name is allowed. */
export async function renameUsername(tx: Q, userId: string, newName: string): Promise<void> {
  const name = newName.toLowerCase();
  const problem = usernameProblem(name);
  if (problem) throw new Error(problem);
  const [cur] = await tx`select username from creators where user_id = ${userId} for update`;
  if (!cur) throw new Error("No creator");
  if (cur.username === name) return;
  const [own] = await tx`delete from username_history where old_username = ${name} and user_id = ${userId} returning 1`;
  if (!own && !(await usernameAvailable(name, tx))) throw new Error("That username is taken.");
  await tx`insert into username_history (old_username, user_id) values (${cur.username}, ${userId}) on conflict do nothing`;
  await tx`update creators set username = ${name} where user_id = ${userId}`;
}
