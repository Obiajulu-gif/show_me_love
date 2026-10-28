import { NextResponse } from "next/server";

import { disconnect } from "@/lib/connect";
import { bad, withApp } from "@/lib/connectApi";

export const POST = (req: Request) => withApp(req, async (app, b) => {
  if (typeof b.user_ref !== "string" || !b.user_ref || b.user_ref.length > 128) return bad("Send user_ref.");
  await disconnect(app, b.user_ref);
  return NextResponse.json({ ok: true });
});
