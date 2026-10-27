import { NextResponse } from "next/server";

import { issueCode } from "@/lib/codes";
import { devHint, sendMail } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { requireUser, Unauthorized } from "@/lib/session";
import { maskedDestinations } from "@/lib/withdrawals";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!(await hit(`wcodereq:${user.id}`, 5, 900))) return NextResponse.json({ error: "Too many codes requested. Try again in 15 minutes." }, { status: 429 });
    const body = await req.json().catch(() => null);
    const to = await maskedDestinations(user.id, body?.method);
    const code = await issueCode(user.id, "withdrawal", 10);
    const mail = await sendMail(user.email, "Your show-me-love withdrawal code", `Your withdrawal code is ${code}. It works once and expires in 10 minutes. The money would go to ${to}. If this wasn't you, ignore this email.`);
    const hint = devHint(mail, code);
    if (!mail.sent && !hint) return NextResponse.json({ error: "Email isn't set up yet. Contact support." }, { status: 503 });
    return NextResponse.json({ ok: true, ...(hint ? { devCode: hint } : {}) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
