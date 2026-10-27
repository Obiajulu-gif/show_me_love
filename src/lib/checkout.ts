import { randomBytes } from "node:crypto";

import { db } from "./db";
import { ngnToUsdt } from "./money";
import { expireIfStale } from "./payments";
import { createPaymentLink } from "./ras";
import { getRate } from "./rates";

/** Safe to show to the supporter. */
export class CheckoutBusy extends Error {}
export class CheckoutInvalid extends Error {}

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
/** 20 chars of [A-Z0-9]. Rejection sampling keeps every character equally likely. */
export function newRef(): string {
  let s = "";
  while (s.length < 20) for (const b of randomBytes(32)) if (b < 252 && s.length < 20) s += ALPHA[b % 36];
  return s;
}

export type CheckoutInput = {
  kind: "treat" | "goal" | "group"; creatorId?: string; goalId?: string; groupId?: string; quantity?: number; amountNgn: number;
  supporter: { name: string; email: string; message?: string; isPublic: boolean }; successPath: string;
  /** Public origin for RAS redirect URLs; defaults to PUBLIC_APP_URL. */
  origin?: string;
};

const MAX_NGN = 10_000_000;

/** Creates a pending payment row at the current rate, then the RAS link. Returns where to send the supporter. */
export async function startCheckout(i: CheckoutInput): Promise<{ ref: string; url: string }> {
  if (i.kind !== "treat" || !i.creatorId) throw new CheckoutInvalid("This kind of payment is not available yet.");
  const [c] = await db()`select unit_price_ngn from creators where user_id = ${i.creatorId}`;
  if (!c) throw new CheckoutInvalid("We couldn't find that page.");
  const unit = Number(c.unit_price_ngn);

  const { name, email, message } = i.supporter;
  if (name.length > 50) throw new CheckoutInvalid("Name can be at most 50 characters.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new CheckoutInvalid("Enter a valid email address.");
  if ((message ?? "").length > 280) throw new CheckoutInvalid("Message can be at most 280 characters.");

  const n = Number.isInteger(i.amountNgn) ? i.amountNgn : NaN;
  let quantity = 1;
  if (i.quantity !== undefined) {
    quantity = i.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) throw new CheckoutInvalid("Pick between 1 and 50.");
    if (n !== unit * quantity) throw new CheckoutInvalid("That amount doesn't match the price. Refresh and try again.");
  } else if (!(n >= unit && n <= MAX_NGN)) {
    throw new CheckoutInvalid(`Choose an amount of at least ₦${unit.toLocaleString("en-NG")}.`);
  }

  let rate: number;
  try { rate = (await getRate()).ngnPerUsd; } catch { throw new CheckoutBusy("Prices are updating, try again in a minute."); }
  const usdt = ngnToUsdt(n, rate);
  const ref = newRef();
  await db()`
    insert into payments (ref, kind, creator_id, supporter_name, supporter_email, message, is_public, quantity, amount_ngn, amount_usdt, rate, status)
    values (${ref}, 'treat', ${i.creatorId}, ${name.trim()}, ${email.trim()}, ${message?.trim() || null}, ${i.supporter.isPublic}, ${quantity}, ${n}, ${usdt}, ${rate}, 'pending')`;

  const base = (i.origin ?? process.env.PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const [first, ...rest] = name.trim().split(/\s+/).filter(Boolean);
  try {
    const link = await createPaymentLink({
      amountNgn: String(n), reference: ref,
      customer: { email: email.trim(), first_name: first ?? "Supporter", last_name: rest.join(" ") || "-" },
      successUrl: `${base}${i.successPath}?ref=${ref}`, cancelUrl: `${base}${i.successPath.replace(/\/thanks$/, "")}`,
      metadata: { ref },
    });
    const url = link.payment_link ?? `${i.successPath}?ref=${ref}&practice=1`;
    await db()`update payments set link_url = ${url} where ref = ${ref}`;
    return { ref, url };
  } catch (e) {
    await db()`update payments set status = 'failed', failure_reason = ${`RAS: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500)} where ref = ${ref}`;
    throw new CheckoutBusy("Checkout is busy, try again.");
  }
}

export async function paymentStatus(ref: string): Promise<{ status: string; amountNgn: number; creatorUsername: string | null } | null> {
  await expireIfStale(ref);
  const [r] = await db()`
    select p.status, p.amount_ngn, c.username from payments p left join creators c on c.user_id = p.creator_id where p.ref = ${ref}`;
  return r ? { status: r.status, amountNgn: Number(r.amount_ngn), creatorUsername: r.username ?? null } : null;
}
