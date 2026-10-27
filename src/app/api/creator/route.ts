import { NextResponse } from "next/server";

import { updateCreator, type EditableCreator } from "@/lib/creators";
import { requireUser, Unauthorized } from "@/lib/session";

const KEYS = ["username", "display_name", "bio", "photo_url", "birthday", "birthday_mode", "socials", "treat_id", "custom_treat", "unit_price_ngn", "presets", "thank_you_text", "page_style"];
// Validation errors thrown by src/lib/creators.ts and usernames.ts are user-facing; anything else is a real failure.
const FRIENDLY = /^(Price must|Presets must|Bio can|Display name|Thank-you|Birthday|Add up to|Page style|Pick a treat|Give your|That username|That name|3–24)/;

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object") return NextResponse.json({ error: "Send the fields to change." }, { status: 400 });
    const patch = Object.fromEntries(Object.entries(b).filter(([k]) => KEYS.includes(k))) as Partial<EditableCreator>;
    return NextResponse.json({ ok: true, creator: await updateCreator(user.id, patch) });
  } catch (e) {
    if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
    if (e instanceof Error && FRIENDLY.test(e.message)) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
