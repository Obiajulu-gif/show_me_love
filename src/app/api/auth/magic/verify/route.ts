import { NextResponse } from "next/server";
import { consumeCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { setSessionCookie } from "@/lib/session";

export async function GET(req: Request) {
  const base = process.env.PUBLIC_APP_URL || new URL(req.url).origin;
  const userId = await consumeCode(null, "login", new URL(req.url).searchParams.get("code") ?? "");
  if (!userId) return NextResponse.redirect(new URL("/login?error=link", base));
  await setSessionCookie(userId);
  const [c] = await db()`select 1 from creators where user_id = ${userId}`;
  return NextResponse.redirect(new URL(c ? "/dashboard" : "/onboarding", base));
}
