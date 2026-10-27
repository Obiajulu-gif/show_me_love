import { db } from "./db";
import { claimUsername } from "./usernames";

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
                'Thanks for the treat. It means a lot.', 'Feeling good today. Make it better: buy me a treat! 😊', ${tx.json(DEFAULT_STYLE)})
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
