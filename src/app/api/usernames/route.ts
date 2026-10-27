import { NextResponse } from "next/server";

import { clientIp } from "@/lib/http";
import { hit } from "@/lib/ratelimit";
import { usernameAvailable, usernameProblem } from "@/lib/usernames";

export async function GET(req: Request) {
  if (!(await hit(`username:${await clientIp()}`, 60, 60))) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });
  const u = new URL(req.url).searchParams.get("username") ?? "";
  const problem = usernameProblem(u);
  return NextResponse.json({ available: !problem && (await usernameAvailable(u)), problem });
}
