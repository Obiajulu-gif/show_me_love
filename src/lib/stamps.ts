import { db } from "./db";
import { isStampStyle, type StampStyle } from "./stampStyles";

export { STAMP_STYLES, isStampStyle } from "./stampStyles";
export type { StampStyle } from "./stampStyles";

export type StampCampaign = {
  id: string;
  creatorId: string;
  headline: string;
  style: StampStyle;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type StampEntry = { name: string | null; handle: string | null; at: Date };
export type StampStats = { total: number; week: number; recent: StampEntry[] };

export type CampaignInput = { headline?: unknown; style?: unknown; active?: unknown };

/** A user-facing validation problem; API routes turn this into a 400. */
export class StampInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StampInputError";
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toCampaign(r: any): StampCampaign {
  return {
    id: r.id, creatorId: r.creator_id, headline: r.headline, style: r.style as StampStyle,
    active: r.active, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

const clean = (v: string) => v.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();

export function sanitizeStampName(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new StampInputError("Send your name as text.");
  const name = clean(value);
  if (name.length > 32) throw new StampInputError("Keep your name to 32 characters.");
  return name;
}

export function sanitizeStampHandle(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new StampInputError("Send your handle as text.");
  const handle = clean(value).replace(/^@+/, "");
  if (!handle) return "";
  if (!/^[A-Za-z0-9._-]{1,24}$/.test(handle)) throw new StampInputError("Handles can use letters, numbers, dots, dashes and underscores.");
  return handle;
}

function parseStyle(value: unknown): StampStyle {
  if (!isStampStyle(value)) throw new StampInputError("Pick a stamp style.");
  return value;
}

export function sanitizeHeadline(value: unknown): string {
  if (typeof value !== "string") throw new StampInputError("Send the headline as text.");
  const headline = clean(value);
  if (!headline) throw new StampInputError("Add a headline for your stamp.");
  if (headline.length > 40) throw new StampInputError("Keep the headline to 40 characters.");
  return headline;
}

export async function getCampaignByCreator(creatorId: string): Promise<StampCampaign | null> {
  const [r] = await db()`select * from stamp_campaigns where creator_id = ${creatorId}`;
  return r ? toCampaign(r) : null;
}

export async function getActiveCampaignByCreator(creatorId: string): Promise<StampCampaign | null> {
  const [r] = await db()`select * from stamp_campaigns where creator_id = ${creatorId} and active = true`;
  return r ? toCampaign(r) : null;
}

export async function getActiveCampaignById(id: string): Promise<StampCampaign | null> {
  const [r] = await db()`select * from stamp_campaigns where id = ${id} and active = true`;
  return r ? toCampaign(r) : null;
}

/**
 * Merge a partial edit over the existing campaign (or defaults), validate, then
 * upsert. One campaign per creator, enforced by the unique key.
 */
export async function saveCampaign(creatorId: string, input: CampaignInput, defaultStyle: string = "honey"): Promise<StampCampaign> {
  const existing = await getCampaignByCreator(creatorId);
  const headline = input.headline !== undefined ? sanitizeHeadline(input.headline) : existing?.headline ?? "I support";
  const style = input.style !== undefined
    ? parseStyle(input.style)
    : existing?.style ?? (isStampStyle(defaultStyle) ? defaultStyle : "honey");
  if (input.active !== undefined && typeof input.active !== "boolean") throw new StampInputError("The active switch must be on or off.");
  const active = input.active !== undefined ? input.active : existing?.active ?? false;

  const [r] = await db()`
    insert into stamp_campaigns (creator_id, headline, style, active)
    values (${creatorId}, ${headline}, ${style}, ${active})
    on conflict (creator_id) do update
      set headline = excluded.headline, style = excluded.style, active = excluded.active, updated_at = now()
    returning *`;
  return toCampaign(r);
}

/** Record one downloaded stamp and return the campaign's running total. */
export async function recordStamp(input: { campaignId: string; creatorId: string; name: string; handle: string }): Promise<number> {
  await db()`
    insert into stamps (campaign_id, creator_id, visitor_name, visitor_handle)
    values (${input.campaignId}, ${input.creatorId}, ${input.name || null}, ${input.handle || null})`;
  const [r] = await db()`select count(*)::int as n from stamps where campaign_id = ${input.campaignId}`;
  return Number(r.n);
}

export async function stampStats(creatorId: string): Promise<StampStats> {
  const [[totals], recent] = await Promise.all([
    db()`select count(*)::int as total, count(*) filter (where created_at >= now() - interval '7 days')::int as week from stamps where creator_id = ${creatorId}`,
    db()`select visitor_name, visitor_handle, created_at from stamps where creator_id = ${creatorId} order by created_at desc limit 10`,
  ]);
  return {
    total: Number(totals.total),
    week: Number(totals.week),
    recent: recent.map((r) => ({ name: r.visitor_name, handle: r.visitor_handle, at: r.created_at })),
  };
}
