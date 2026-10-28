import { db } from "./db";
import { claimUsername, renameUsername } from "./usernames";

export type Creator = {
  userId: string; username: string; displayName: string | null; bio: string | null; photoUrl: string | null;
  birthday: string | null; birthdayMode: string | null; socials: Record<string, string>;
  treatId: string | null; customTreat: { name: string; emoji: string } | null;
  unitPriceNgn: number; presets: number[]; thankYouText: string | null;
  pageStyle: { accent?: string; tagline?: string; header?: string; [k: string]: unknown };
  shareMessage: string | null; payoutAddress: string | null; payoutNetwork: "bep20" | "trc20" | null;
  bank: Record<string, string> | null; createdAt: Date;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toCreator(r: any): Creator {
  return {
    userId: r.user_id, username: r.username, displayName: r.display_name, bio: r.bio, photoUrl: r.photo_url,
    birthday: r.birthday, birthdayMode: r.birthday_mode, socials: r.socials, treatId: r.treat_id, customTreat: r.custom_treat,
    unitPriceNgn: Number(r.unit_price_ngn), presets: r.presets, thankYouText: r.thank_you_text, pageStyle: r.page_style,
    shareMessage: r.share_message, payoutAddress: r.payout_address, payoutNetwork: r.payout_network, bank: r.bank, createdAt: r.created_at,
  };
}

const PICK = "Pick a treat from the list or choose Custom.";
const TAKEN ="That username is taken.";
const DEFAULT_STYLE = { accent: "honey", tagline: "A little love. A lot of possibility.", header: "default" };

export async function createCreator(
  userId: string,
  input: { username: string; treatId: string; customTreat?: { name: string; emoji: string } },
): Promise<Creator> {
  const username = input.username.toLowerCase();
  try {
    return await db().begin(async (tx) => {
      const [have] = await tx`select 1 from creators where user_id = ${userId}`;
      if (have) throw new Error("You already have a page.");
      const ct = input.customTreat;
      if (input.treatId === "custom") {
        if (!ct || !ct.name?.trim() || ct.name.length > 30 || !ct.emoji?.trim() || ct.emoji.length > 8) throw new Error("Give your custom treat a short name and an emoji.");
      } else if (ct || !(await tx`select 1 from treat_catalog where id = ${input.treatId} and active`).length) throw new Error(PICK);
      await claimUsername(tx, username);
      const [r] = await tx`
        insert into creators (user_id, username, display_name, treat_id, custom_treat, unit_price_ngn, presets, thank_you_text, share_message, page_style)
        values (${userId}, ${username}, ${username}, ${input.treatId}, ${input.customTreat ? tx.json(input.customTreat) : null}, 500, ${[1, 3, 5]},
                'Thanks for the treat. It means a lot.', 'Feeling good today. Send a little love my way 😊', ${tx.json(DEFAULT_STYLE)})
        returning *`;
      return toCreator(r);
    });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      const [have] = await db()`select 1 from creators where user_id = ${userId}`;
      throw new Error(have ? "You already have a page." : TAKEN);
    }
    throw e;
  }
}

export async function getCreatorByUser(userId: string): Promise<Creator | null> {
  const [r] = await db()`select * from creators where user_id = ${userId}`;
  return r ? toCreator(r) : null;
}

export async function getCreatorByUsername(u: string): Promise<Creator | null> {
  const [r] = await db()`select * from creators where username = ${u}`;
  return r ? toCreator(r) : null;
}

export type EditableCreator = {
  username: string; display_name: string; bio: string | null; photo_url: string | null; birthday: string | null;
  birthday_mode: "off" | "show_day" | "celebrate"; socials: Record<string, string>; treat_id: string;
  custom_treat: { name: string; emoji: string } | null; unit_price_ngn: number; presets: number[];
  thank_you_text: string | null; page_style: Creator["pageStyle"]; share_message: string | null;
};

const int = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

function validate(p: Partial<EditableCreator>) {
  if ("unit_price_ngn" in p && !(int(p.unit_price_ngn) && p.unit_price_ngn >= 100 && p.unit_price_ngn <= 1_000_000)) throw new Error("Price must be between ₦100 and ₦1,000,000.");
  if ("presets" in p) {
    const a = p.presets;
    if (!Array.isArray(a) || a.length < 1 || a.length > 3 || !a.every((n) => int(n) && n >= 1 && n <= 50) || new Set(a).size !== a.length)
      throw new Error("Presets must be 1 to 3 different whole numbers from 1 to 50.");
  }
  if (p.bio != null && p.bio.length > 280) throw new Error("Bio can be at most 280 characters.");
  if ("display_name" in p && !(typeof p.display_name === "string" && p.display_name.trim().length >= 1 && p.display_name.length <= 50)) throw new Error("Display name must be 1 to 50 characters.");
  if ("share_message" in p && p.share_message != null && !(typeof p.share_message === "string" && p.share_message.length <= 280)) throw new Error("Share message can be at most 280 characters.");
  if (p.thank_you_text != null && p.thank_you_text.length > 120) throw new Error("Thank-you line can be at most 120 characters.");
  if ("birthday_mode" in p && !["off", "show_day", "celebrate"].includes(p.birthday_mode as string)) throw new Error("Birthday setting must be off, show_day or celebrate.");
  if (p.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(p.birthday)) throw new Error("Birthday must be a valid date.");
  if (p.socials) {
    const v = Object.values(p.socials);
    if (v.length > 6 || !v.every((u) => { try { return new URL(u).protocol === "https:"; } catch { return false; } })) throw new Error("Add up to 6 social links, each starting with https://.");
  }
  if ("treat_id" in p && p.treat_id !== "custom" && !p.treat_id) throw new Error(PICK);
  const okUrl = (u: unknown) => u == null || (typeof u === "string" && (/^\/uploads\//.test(u) || /^https:\/\//.test(u)));
  if (!okUrl(p.photo_url) || !okUrl((p.page_style as { cover?: unknown } | undefined)?.cover)) throw new Error("Page style is not valid.");
  const ct = p.custom_treat;
  if (p.treat_id === "custom" && !(ct && ct.name?.trim() && ct.name.length <= 30 && ct.emoji?.trim() && ct.emoji.length <= 8)) throw new Error("Give your custom treat a short name and an emoji.");
  const ps = p.page_style;
  if (ps && ((ps.tagline && ps.tagline.length > 80) || (ps.accent && !["honey", "cocoa", "sage"].includes(ps.accent)) || (ps.header && !["default", "cover"].includes(ps.header))))
    throw new Error("Page style is not valid.");
}

/** Partial update of the signed-in creator's own row. Only whitelisted columns; username goes through renameUsername. */
export async function updateCreator(userId: string, patch: Partial<EditableCreator>): Promise<Creator> {
  validate(patch);
  return db().begin(async (tx) => {
    if (patch.username !== undefined) await renameUsername(tx, userId, patch.username);
    const cols: Record<string, unknown> = {};
    for (const k of ["display_name", "bio", "photo_url", "birthday", "birthday_mode", "treat_id", "unit_price_ngn", "thank_you_text", "share_message"] as const)
      if (k in patch) cols[k] = patch[k] ?? null;
    if (patch.presets) cols.presets = patch.presets;
    if (patch.socials) cols.socials = tx.json(patch.socials);
    if ("custom_treat" in patch) cols.custom_treat = patch.custom_treat ? tx.json(patch.custom_treat) : null;
    if (patch.page_style) cols.page_style = tx.json(patch.page_style as never);
    if ("treat_id" in cols && cols.treat_id !== "custom" && !(await tx`select 1 from treat_catalog where id = ${cols.treat_id as string} and active`).length) throw new Error(PICK);
    if (Object.keys(cols).length) await tx`update creators set ${tx(cols as never)} where user_id = ${userId}`;
    const [r] = await tx`select * from creators where user_id = ${userId}`;
    if (!r) throw new Error("No creator");
    return toCreator(r);
  });
}
