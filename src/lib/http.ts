import { headers } from "next/headers";

/** Client IP, hardest to spoof first: Vercel's header, x-real-ip, then the LAST x-forwarded-for hop (the one our proxy appended). */
export function pickIp(h: Pick<Headers, "get">): string {
  const last = h.get("x-forwarded-for")?.split(",").pop()?.trim();
  return h.get("x-vercel-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip")?.trim() || last || "local";
}

export async function clientIp(): Promise<string> {
  return pickIp(await headers());
}
