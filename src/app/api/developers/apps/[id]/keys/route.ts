import { NextResponse } from "next/server";

import { ConnectError, createKey, KEY_NOT_FOUND, NOT_FOUND, revokeKey } from "@/lib/connect";
import { rejectCrossSite } from "@/lib/http";
import { requireUser, Unauthorized } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  if (e instanceof Unauthorized) return NextResponse.json({ error: e.message }, { status: 401 });
  if (e instanceof ConnectError) return NextResponse.json({ error: e.message }, { status: e.message === NOT_FOUND || e.message === KEY_NOT_FOUND ? 404 : 400 });
  throw e;
}

/** The only response that ever contains a full key. */
export async function POST(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = NextResponse.json({ ok: true, ...(await createKey(user.id, id)) });
    res.headers.set("cache-control", "no-store");
    return res;
  } catch (e) { return fail(e); }
}

/** DELETE { keyId } revokes a key of this app. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = rejectCrossSite(req);
  if (blocked) return blocked;
  try {
    const user = await requireUser();
    const { id } = await params;
    const b = await req.json().catch(() => null);
    if (!b || typeof b !== "object" || typeof b.keyId !== "string") return NextResponse.json({ error: "Send the keyId to revoke." }, { status: 400 });
    await revokeKey(user.id, b.keyId, id);
    return NextResponse.json({ ok: true });
  } catch (e) { return fail(e); }
}
