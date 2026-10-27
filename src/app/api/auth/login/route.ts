import { NextResponse } from "next/server";
import { AuthError, signIn } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { hit } from "@/lib/ratelimit";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json().catch(() => ({}));
    const key = `login:${String(email ?? "").trim().toLowerCase()}:${await clientIp()}`;
    if (!(await hit(key, 10, 15 * 60))) return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
    const { id } = await signIn(email, password);
    await setSessionCookie(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
