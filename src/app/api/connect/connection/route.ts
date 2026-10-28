import { NextResponse } from "next/server";

import { getConnection } from "@/lib/connect";
import { bad, userRefParam, withApp } from "@/lib/connectApi";

export const GET = (req: Request) => withApp(req, async (app) => {
  const ref = userRefParam(req);
  if (!ref) return bad("Send user_ref.");
  const c = await getConnection(app, ref);
  return c ? NextResponse.json(c) : bad("Not connected.", 404);
});
