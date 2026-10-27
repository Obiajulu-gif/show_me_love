/** Sign-in: a signed httpOnly cookie holding the user id. */
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

export const SESSION_COOKIE = "sml_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

export class Unauthorized extends Error {
  constructor() {
    super("Please sign in.");
  }
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET must be set (32+ random characters) in production");
  return new TextEncoder().encode("dev-only-session-secret-change-me-0123456789");
}

export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  (await cookies()).set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function currentUserId(): Promise<string | null> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(): Promise<{ id: string; email: string; role: string }> {
  const id = await currentUserId();
  if (!id) throw new Unauthorized();
  const [u] = await db()`select id, email, role from users where id = ${id}`;
  if (!u) throw new Unauthorized();
  return { id: u.id, email: u.email, role: u.role };
}
