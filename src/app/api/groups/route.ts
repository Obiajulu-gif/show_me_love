import { NextResponse } from "next/server";

import { CheckoutBusy } from "@/lib/checkout";
import { GroupError, startGroupCheckout, type GroupInput } from "@/lib/groups";
import { clientIp, rejectCrossSite } from "@/lib/http";
import { hit } from "@/lib/ratelimit";
import { requireUser, Unauthorized } from "@/lib/session";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function POST(req: Request) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!isObj(b)) return bad("Send the group details.");
    const { usernames, currency, total, split, message, isPublic } = b;
    if (!Array.isArray(usernames) || usernames.length > 25 || usernames.some((x) => typeof x !== "string" || x.length > 40)) return bad("Add 2–10 creators.");
    if (currency !== "NGN" && currency !== "USD") return bad("Pick NGN or USD.");
    if (typeof total !== "number" || !Number.isFinite(total)) return bad("Enter the total amount.");
    if (message !== undefined && message !== null && typeof message !== "string") return bad("Your message should be text.");
    if (typeof isPublic !== "boolean") return bad("Something went wrong with that form. Please reload.");
    if (split !== "even") {
      const c = isObj(split) ? split.custom : null;
      if (!isObj(c) || Object.values(c).some((v) => typeof v !== "number" || !Number.isFinite(v))) return bad("Pick an even or custom split.");
    }

    if (!(await hit(`checkout:${await clientIp()}`, 10, 600))) return bad("Too many tries. Please wait a few minutes.", 429);
    const out = await startGroupCheckout(user.id, {
      usernames: usernames as string[], currency, total, split: split as GroupInput["split"], message: (message as string | null | undefined) ?? undefined, isPublic,
    }, process.env.PUBLIC_APP_URL || new URL(req.url).origin);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof Unauthorized) return bad(e.message, 401);
    if (e instanceof GroupError) return bad(e.message);
    if (e instanceof CheckoutBusy) return bad(e.message, 503);
    throw e;
  }
}
