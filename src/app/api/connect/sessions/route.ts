import { NextResponse } from "next/server";

import { ConnectError, createSession } from "@/lib/connect";
import { bad, withApp } from "@/lib/connectApi";

export const POST = (req: Request) => withApp(req, async (app, b) => {
  if (typeof b.user_ref !== "string" || typeof b.redirect_uri !== "string" || (b.state !== undefined && typeof b.state !== "string")) {
    return bad("Send user_ref, redirect_uri and an optional state as strings.");
  }
  try {
    return NextResponse.json({ authorize_url: await createSession(app, { userRef: b.user_ref, redirectUri: b.redirect_uri, state: b.state as string | undefined }) });
  } catch (e) {
    if (e instanceof ConnectError) return bad(e.message);
    throw e;
  }
});
