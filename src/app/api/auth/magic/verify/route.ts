import { NextResponse } from "next/server";
import { grantAdminIfListed } from "@/lib/auth";
import { consumeCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { rejectCrossOrigin } from "@/lib/http";
import { safeNext } from "@/lib/safeNext";
import { setSessionCookie } from "@/lib/session";

const baseOf = (req: Request) => process.env.PUBLIC_APP_URL || new URL(req.url).origin;

/**
 * Opening the emailed link only shows a "Sign in" button. Mail scanners (Gmail, Outlook) prefetch links,
 * and a GET that spent the single-use code left the real click with a dead link.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const to = new URL("/login/link", baseOf(req));
  to.searchParams.set("code", q.get("code") ?? "");
  if (safeNext(q.get("next"))) to.searchParams.set("next", safeNext(q.get("next"))!);
  return NextResponse.redirect(to);
}

export async function POST(req: Request) {
  const bad = rejectCrossOrigin(req);
  if (bad) return bad;
  const base = baseOf(req);
  const f = await req.formData().catch(() => null);
  const userId = await consumeCode(null, "login", String(f?.get("code") ?? ""));
  if (!userId) return NextResponse.redirect(new URL("/login?error=link", base), 303);
  await grantAdminIfListed(userId);
  await setSessionCookie(userId);
  const [c] = await db()`select 1 from creators where user_id = ${userId}`;
  return NextResponse.redirect(new URL(safeNext(String(f?.get("next") ?? "")) ?? (c ? "/dashboard" : "/onboarding"), base), 303);
}
