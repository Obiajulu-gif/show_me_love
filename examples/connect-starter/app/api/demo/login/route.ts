import { go, home } from "../../../../lib/demo";

/** DEMO ONLY: logs you in as a made-up user. */
export async function POST() {
  return go(home(), { "Set-Cookie": "demo_user=1; HttpOnly; SameSite=Lax; Path=/" });
}
