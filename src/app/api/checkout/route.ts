import { NextResponse } from "next/server";

import { CheckoutBusy, CheckoutInvalid, startCheckout } from "@/lib/checkout";
import { getCreatorByUsername } from "@/lib/creators";
import { clientIp } from "@/lib/http";
import { hit } from "@/lib/ratelimit";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Send the checkout details.");
  const { username, quantity, amountNgn, name, email, message, isPublic } = b as Record<string, unknown>;
  if (typeof username !== "string" || typeof email !== "string" || typeof name !== "string") return bad("Please fill in your name and email.");
  if (message !== undefined && message !== null && typeof message !== "string") return bad("Your message should be text.");
  if (isPublic !== undefined && typeof isPublic !== "boolean") return bad("Something went wrong with that form. Please reload.");
  const num = (v: unknown) => v === undefined || v === null || (typeof v === "number" && Number.isFinite(v));
  if (!num(quantity) || !num(amountNgn) || (quantity == null && amountNgn == null)) return bad("Pick how many treats, or an amount.");

  if (!(await hit(`checkout:${await clientIp()}`, 10, 600))) return bad("Too many tries. Please wait a few minutes.", 429);
  const c = await getCreatorByUsername(username);
  if (!c) return bad("We couldn't find that page.", 404);

  try {
    const q = quantity == null ? undefined : (quantity as number);
    const out = await startCheckout({
      kind: "treat", creatorId: c.userId, quantity: q,
      amountNgn: q !== undefined ? c.unitPriceNgn * q : (amountNgn as number),
      supporter: { name, email, message: (message as string | null | undefined) ?? undefined, isPublic: isPublic ?? true },
      successPath: `/@${c.username}/thanks`, origin: process.env.PUBLIC_APP_URL || new URL(req.url).origin,
    });
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof CheckoutInvalid) return bad(e.message);
    if (e instanceof CheckoutBusy) return bad(e.message, 503);
    throw e;
  }
}
