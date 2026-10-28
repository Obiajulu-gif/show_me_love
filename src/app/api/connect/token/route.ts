import { NextResponse } from "next/server";

import { ConnectError, exchangeCode } from "@/lib/connect";
import { bad, withApp } from "@/lib/connectApi";

export const POST = (req: Request) => withApp(req, async (app, b) => {
  if (typeof b.code !== "string") return bad("Send the code as a string.");
  try {
    return NextResponse.json(await exchangeCode(app, b.code));
  } catch (e) {
    if (e instanceof ConnectError) return bad(e.message);
    throw e;
  }
});
