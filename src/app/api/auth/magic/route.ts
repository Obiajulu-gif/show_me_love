import { NextResponse } from "next/server";
import { issueCode } from "@/lib/codes";
import { db } from "@/lib/db";
import { devHint, sendMail } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { safeNext } from "@/lib/safeNext";

export async function POST(req: Request) {
  const { email, next } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  if (!e) return NextResponse.json({ error: "Enter your email." }, { status: 400 });
  if (!(await hit(`magic:${e}`, 5, 3600))) return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  const [u] = await db()`select id from users where email = ${e}`;
  let devLink: string | undefined;
  if (u) {
    const code = await issueCode(u.id, "login", 15);
    const url = `${process.env.PUBLIC_APP_URL ?? ""}/api/auth/magic/verify?code=${code}${safeNext(next) ? `&next=${encodeURIComponent(safeNext(next)!)}` : ""}`;
    devLink = devHint(await sendMail(e, "Your show-me-love sign-in link", `Sign in to show-me-love (valid for 15 minutes):\n\n${url}`), url);
  }
  // Same response whether or not the account exists (devLink only shows in dev with no mail provider).
  return NextResponse.json({ ok: true, devLink });
}
