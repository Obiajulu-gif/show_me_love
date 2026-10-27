import { NextResponse } from "next/server";
import { AuthError, signUp } from "@/lib/auth";
import { clientIp } from "@/lib/http";
import { hit } from "@/lib/ratelimit";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json().catch(() => ({}));
    if (!(await hit(`signup:${await clientIp()}`, 10, 3600))) return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
    const { id } = await signUp(email, password);
    await setSessionCookie(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
