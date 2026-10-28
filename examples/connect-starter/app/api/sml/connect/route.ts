import { demoUser, go, home } from "../../../../lib/demo";
import { sml } from "../../../../lib/sml";

export async function POST(req: Request) {
  const userRef = demoUser(req); // from our own session
  if (!userRef) return go(home());
  const state = crypto.randomUUID();
  const { status, data } = await sml("/sessions", { method: "POST", body: { user_ref: userRef, redirect_uri: process.env.SML_REDIRECT_URI, state } });
  if (status !== 200 || typeof data.authorize_url !== "string") return go(home("?error=" + encodeURIComponent(String(data.error ?? "Could not start"))));
  return go(data.authorize_url, { "Set-Cookie": `sml_state=${state}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/` });
}
