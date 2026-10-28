import { db } from "./db";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

export class AuthError extends Error {}

const normEmail = (e: string) => String(e ?? "").trim().toLowerCase();

export async function signUp(email: string, password: string): Promise<{ id: string }> {
  if (typeof email !== "string") throw new AuthError("Enter a valid email address.");
  if (typeof password !== "string") throw new AuthError("Enter a password.");
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AuthError("Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new AuthError(problem);
  const [u] = await db()`
    insert into users (email, password_hash, role) values (${e}, ${await hashPassword(password)}, 'creator')
    on conflict (email) do nothing returning id`;
  if (!u) throw new AuthError("That email already has an account.");
  return { id: u.id };
}

/** Admin is granted only after the inbox is proven: call this from a successful magic-link login, never from signup or password login. */
export async function grantAdminIfListed(userId: string): Promise<void> {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!admins.length) return;
  await db()`update users set role = 'admin' where id = ${userId} and lower(email) = any(${admins})`;
}

export async function signIn(email: string, password: string): Promise<{ id: string }> {
  const [u] = await db()`select id, password_hash from users where email = ${normEmail(email)}`;
  const ok = await verifyPassword(String(password ?? ""), u?.password_hash);
  if (!u || !ok) throw new AuthError("Email or password is wrong.");
  return { id: u.id };
}
