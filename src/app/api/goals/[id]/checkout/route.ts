import { NextResponse } from "next/server";

import { CheckoutBusy, CheckoutInvalid } from "@/lib/checkout";
import { GoalError, startGoalCheckout } from "@/lib/goals";
import { clientIp } from "@/lib/http";
import { hit } from "@/lib/ratelimit";

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

/** Public: a supporter contributes to a goal. The amount is in the goal's own currency. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad("Send the contribution details.");
  const { amount, name, email, message, isPublic } = b as Record<string, unknown>;
  if (typeof amount !== "number" || typeof email !== "string" || typeof name !== "string") return bad("Please fill in your name, email and amount.");
  if (message !== undefined && message !== null && typeof message !== "string") return bad("Your message should be text.");
  if (isPublic !== undefined && typeof isPublic !== "boolean") return bad("Something went wrong with that form. Please reload.");
  if (!(await hit(`checkout:${await clientIp()}`, 10, 600))) return bad("Too many tries. Please wait a few minutes.", 429);
  try {
    const out = await startGoalCheckout(id, amount, { name, email, message: (message as string | null | undefined) ?? undefined, isPublic: isPublic ?? true },
      process.env.PUBLIC_APP_URL || new URL(req.url).origin);
    return NextResponse.json({ ok: true, ...out });
  } catch (e) {
    if (e instanceof GoalError || e instanceof CheckoutInvalid) return bad(e.message, e.message.startsWith("We couldn") ? 404 : 400);
    if (e instanceof CheckoutBusy) return bad(e.message, 503);
    throw e;
  }
}
