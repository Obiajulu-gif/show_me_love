import { db } from "./db";
import { hashPassword, passwordProblem, verifyPassword } from "./password";

export class AuthError extends Error {}

const normEmail = (e: string) => String(e ?? "").trim().toLowerCase();

export async function signUp(email: string, password: string): Promise<{ id: string }> {
  const e = normEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new AuthError("Enter a valid email address.");
  const problem = passwordProblem(password);
  if (problem) throw new AuthError(problem);
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const role = admins.includes(e) ? "admin" : "creator";
  const [u] = await db()`
    insert into users (email, password_hash, role) values (${e}, ${await hashPassword(password)}, ${role})
    on conflict (email) do nothing returning id`;
  if (!u) throw new AuthError("That email already has an account.");
  return { id: u.id };
}

export async function signIn(email: string, password: string): Promise<{ id: string }> {
  const [u] = await db()`select id, password_hash from users where email = ${normEmail(email)}`;
  const ok = await verifyPassword(String(password ?? ""), u?.password_hash);
  if (!u || !ok) throw new AuthError("Email or password is wrong.");
  return { id: u.id };
}
