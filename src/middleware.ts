import { NextResponse, type NextRequest } from "next/server";

/** `/@name/...` is served from `/u/name/...` (a folder starting with `@` would be a parallel-route slot). */
export function middleware(req: NextRequest) {
  const m = req.nextUrl.pathname.match(/^\/@([A-Za-z0-9_]+)(\/.*)?$/);
  if (!m) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/u/${m[1]}${m[2] ?? ""}`;
  return NextResponse.rewrite(url);
}

// Only `/@...` paths: never runs on _next, api or static files.
export const config = { matcher: ["/:handle(@[^/]+)/:rest*"] };
