import { NextResponse } from "next/server";

import { Forbidden, getEarnings } from "@/lib/connect";
import { bad, userRefParam, withApp } from "@/lib/connectApi";

export const GET = (req: Request) => withApp(req, async (app) => {
  const ref = userRefParam(req);
  if (!ref) return bad("Send user_ref.");
  try {
    const e = await getEarnings(app, ref);
    return e ? NextResponse.json(e) : bad("Not connected.", 404);
  } catch (e) {
    if (e instanceof Forbidden) return bad(e.message, 403);
    throw e;
  }
});
