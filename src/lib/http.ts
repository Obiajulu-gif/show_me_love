import { headers } from "next/headers";

export async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
}
