import { NextResponse } from "next/server";

import { issueCode } from "@/lib/codes";
import { devHint, sendMail } from "@/lib/email";
import { hit } from "@/lib/ratelimit";
import { requireUser, Unauthorized } from "@/lib/session";

export async function POST() {
  try {
    const user = await requireUser();
    if (!(await hit(`wcodereq:${user.id}`, 5, 900))) return NextResponse.json({ error: "Too many codes requested. Try again in 15 minutes." }, { status: 429 });
    const code = await issueCode(user.id, "withdrawal", 10);
    const mail = await sendMail(user.email, "Your show-me-love withdrawal code", `Your withdrawal code is ${code}. It works once and expires in 10 minutes. If this wasn't you, ignore this email.`);
    const hint = devHint(mail, code);
    if (!mail.sent && !hint) return NextResponse.json({ error: "Email isn't set up yet. Contact support." }, { status: 503 });
    return NextResponse.json({ ok: true, ...(hint ? { devCode: hint } : {}) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    throw e;
  }
}
