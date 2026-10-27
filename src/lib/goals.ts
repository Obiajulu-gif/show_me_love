import { db } from "./db";
import { CheckoutBusy, paymentStatus, startCheckout } from "./checkout";
import { getRate } from "./rates";

/** Safe to show to the creator or supporter. */
export class GoalError extends Error {}

export type Currency = "NGN" | "USD";
export type HeaderMode = "default" | "logo" | "hidden";
export type Goal = {
  id: string; creatorId: string; slug: string; title: string; story: string; coverUrl: string | null;
  currency: Currency; target: number; suggested: number; showProgress: boolean; showTarget: boolean;
  organizerName: string | null; organizerPhoto: string | null; headerMode: HeaderMode;
  paused: boolean; currencyLocked: boolean; createdAt: Date;
};
export type GoalInput = {
  title: string; story?: string; coverUrl?: string | null; currency: Currency; target: number; suggested: number;
  showProgress?: boolean; showTarget?: boolean; organizerName?: string | null; organizerPhoto?: string | null; headerMode?: HeaderMode;
};

const NOT_FOUND = "We couldn't find that goal.";
const LOCKED = "Currency locks when the first checkout starts.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODES: readonly string[] = ["default", "logo", "hidden"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toGoal(r: any): Goal {
  return {
    id: r.id, creatorId: r.creator_id, slug: r.slug, title: r.title, story: r.story ?? "", coverUrl: r.cover_url, currency: r.currency,
    target: Number(r.target), suggested: Number(r.suggested?.[0] ?? 0), showProgress: r.show_progress, showTarget: r.show_target,
    organizerName: r.organizer_name, organizerPhoto: r.organizer_photo, headerMode: r.header_mode,
    paused: r.paused, currencyLocked: r.currency_locked, createdAt: r.created_at,
  };
}

/** Two decimals at most; JSON numbers like 1.1 are not exact in binary, so compare with a tolerance. */
const twoDp = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

function money(label: string, v: unknown, currency: Currency): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) throw new GoalError(`${label} must be more than zero.`);
  if (currency === "NGN" && !Number.isInteger(v)) throw new GoalError(`${label} must be a whole number of naira.`);
  if (currency === "USD" && !twoDp(v)) throw new GoalError(`${label} can have at most 2 decimal places.`);
  if (v > 1e9) throw new GoalError(`${label} is too large.`);
  return currency === "USD" ? Math.round(v * 100) / 100 : v;
}

function check(i: GoalInput): GoalInput {
  const title = typeof i.title === "string" ? i.title.trim() : "";
  if (title.length < 3 || title.length > 80) throw new GoalError("Title must be 3 to 80 characters.");
  if (i.story !== undefined && i.story !== null && (typeof i.story !== "string" || i.story.length > 2000)) throw new GoalError("Story can be at most 2000 characters.");
  if (i.currency !== "NGN" && i.currency !== "USD") throw new GoalError("Currency must be NGN or USD.");
  if (i.headerMode !== undefined && !MODES.includes(i.headerMode)) throw new GoalError("Pick a goal header from the list.");
  for (const k of ["showProgress", "showTarget"] as const) {
    if (i[k] !== undefined && typeof i[k] !== "boolean") throw new GoalError(`${k === "showProgress" ? "Show progress" : "Show target"} must be on or off.`);
  }
  for (const k of ["organizerName", "organizerPhoto", "coverUrl"] as const) {
    const v = i[k];
    if (v !== undefined && v !== null && (typeof v !== "string" || v.length > (k === "organizerName" ? 60 : 500))) throw new GoalError(`${k === "organizerName" ? "Organizer name" : "Image link"} is too long.`);
  }
  return {
    ...i, title, target: money("Target", i.target, i.currency), suggested: money("Suggested contribution", i.suggested, i.currency),
  };
}

function slugify(title: string): string {
  const s = title.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  return s || "goal";
}

export async function createGoal(userId: string, input: GoalInput): Promise<Goal> {
  const i = check(input);
  const slug0 = slugify(i.title);
  for (let n = 1; n <= 50; n++) {
    const slug = n === 1 ? slug0 : `${slug0}-${n}`;
    const [r] = await db()`
      insert into goals (creator_id, slug, title, story, cover_url, currency, target, suggested, show_progress, show_target, organizer_name, organizer_photo, header_mode)
      values (${userId}, ${slug}, ${i.title}, ${i.story ?? ""}, ${i.coverUrl ?? null}, ${i.currency}, ${i.target}, ${[i.suggested]}, ${i.showProgress ?? true}, ${i.showTarget ?? true},
              ${i.organizerName?.trim() || null}, ${i.organizerPhoto ?? null}, ${i.headerMode ?? "default"})
      on conflict (creator_id, slug) do nothing returning *`;
    if (r) return toGoal(r);
  }
  throw new GoalError("Pick a more distinctive title.");
}

async function owned(userId: string, id: string): Promise<Goal> {
  const [r] = UUID.test(id) ? await db()`select * from goals where id = ${id} and creator_id = ${userId}` : [];
  if (!r) throw new GoalError(NOT_FOUND);
  return toGoal(r);
}

export async function listGoals(userId: string): Promise<Goal[]> {
  return (await db()`select * from goals where creator_id = ${userId} order by created_at desc`).map(toGoal);
}

export async function updateGoal(userId: string, id: string, patch: Partial<GoalInput>): Promise<Goal> {
  const cur = await owned(userId, id);
  const next = check({ ...cur, ...patch, story: patch.story ?? cur.story } as GoalInput);
  if (next.currency !== cur.currency) {
    const [used] = await db()`select 1 from payments where goal_id = ${id} limit 1`;
    if (cur.currencyLocked || used) throw new GoalError(LOCKED);
  }
  const [r] = await db()`
    update goals set title = ${next.title}, story = ${next.story ?? ""}, cover_url = ${next.coverUrl ?? null}, currency = ${next.currency},
      target = ${next.target}, suggested = ${[next.suggested]}, show_progress = ${next.showProgress ?? true}, show_target = ${next.showTarget ?? true},
      organizer_name = ${next.organizerName?.trim() || null}, organizer_photo = ${next.organizerPhoto ?? null}, header_mode = ${next.headerMode ?? "default"}
    where id = ${id} and creator_id = ${userId} and (currency = ${next.currency} or not currency_locked) returning *`;
  if (!r) throw new GoalError(LOCKED);
  return toGoal(r);
}

export async function setPaused(userId: string, id: string, paused: boolean): Promise<Goal> {
  await owned(userId, id);
  const [r] = await db()`update goals set paused = ${paused === true} where id = ${id} and creator_id = ${userId} returning *`;
  return toGoal(r);
}

/** Public lookup: the slug must belong to this creator, whatever name they use now. */
export async function getPublicGoal(username: string, slug: string): Promise<(Goal & { organizerFallback: string }) | null> {
  const [r] = await db()`
    select g.*, c.display_name, c.username from goals g join creators c on c.user_id = g.creator_id
    where c.username = ${username} and g.slug = ${slug}`;
  return r ? { ...toGoal(r), organizerFallback: r.display_name || r.username } : null;
}

/** Successful payments only, before fees. NGN: integer naira. USD: decimal string from the USDT RAS reported. */
export async function goalProgress(goalId: string): Promise<{ raised: number | string; count: number }> {
  const [g] = UUID.test(goalId) ? await db()`select currency from goals where id = ${goalId}` : [];
  if (!g) throw new GoalError(NOT_FOUND);
  const [r] = await db()`
    select count(*)::int as count,
           coalesce(sum(amount_ngn), 0)::text as ngn,
           round(coalesce(sum(received_usdt), 0), 2)::text as usd
    from payments where goal_id = ${goalId} and status = 'successful'`;
  return { raised: g.currency === "USD" ? r.usd : Number(r.ngn), count: r.count };
}

export async function goalContributors(goalId: string, limit = 20): Promise<{ name: string; message: string | null; at: Date }[]> {
  const rows = await db()`
    select supporter_name, message, completed_at from payments
    where goal_id = ${goalId} and status = 'successful' and is_public order by completed_at desc limit ${limit}`;
  return rows.map((r) => ({ name: r.supporter_name || "Someone kind", message: r.message, at: r.completed_at }));
}

type Supporter = { name: string; email: string; message?: string; isPublic: boolean };

/** `amount` is in the goal's currency. USD converts to naira at today's rate, rounded up to a whole naira. */
export async function startGoalCheckout(goalId: string, amount: number, supporter: Supporter, origin?: string): Promise<{ ref: string; url: string }> {
  // Lock first, atomically: after this statement no currency change can land, and we price from the currency it returns.
  const [lk] = UUID.test(goalId) ? await db()`update goals set currency_locked = true where id = ${goalId} and not paused returning *` : [];
  if (!lk) {
    const [ex] = UUID.test(goalId) ? await db()`select 1 from goals where id = ${goalId}` : [];
    throw new GoalError(ex ? "This goal is paused." : "We couldn't find that goal.");
  }
  const g = toGoal(lk);
  const [{ username }] = await db()`select username from creators where user_id = ${g.creatorId}`;
  const r = { username };

  if (typeof amount !== "number" || !Number.isFinite(amount)) throw new GoalError("Enter an amount.");
  let amountNgn: number;
  if (g.currency === "NGN") {
    if (!Number.isInteger(amount)) throw new GoalError("Enter a whole number of naira.");
    if (amount < 100) throw new GoalError("The smallest contribution is ₦100.");
    amountNgn = amount;
  } else {
    if (!twoDp(amount)) throw new GoalError("Use at most 2 decimal places.");
    if (amount < 1) throw new GoalError("The smallest contribution is $1.");
    let rate: number;
    try { rate = (await getRate()).ngnPerUsd; } catch { throw new CheckoutBusy("Prices are updating, try again in a minute."); }
    amountNgn = Math.ceil(Math.round(amount * 100) * rate / 100 - 1e-9);
  }

  const out = await startCheckout({
    kind: "goal", goalId, amountNgn, supporter, successPath: `/@${r.username}/goals/${g.slug}`, origin,
  });
  return out;
}

/** The supporter's own payment for this goal, for the "thank you" state. Null when the ref is not a payment toward this goal. */
export async function goalPaymentStatus(goalId: string, ref: string): Promise<{ status: string; amountNgn: number } | null> {
  if (!/^[A-Z0-9]{20}$/.test(ref)) return null;
  const s = await paymentStatus(ref);
  if (!s) return null;
  const [p] = await db()`select 1 from payments where ref = ${ref} and goal_id = ${goalId}`;
  return p ? { status: s.status, amountNgn: s.amountNgn } : null;
}
