import { demoUser, getCookie, go, home, stateOk } from "../../../../lib/demo";
import { sml } from "../../../../lib/sml";

const CLEAR_STATE = "sml_state=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (!demoUser(req)) return go(home());
  if (!stateOk(getCookie(req, "sml_state"), q.get("state"))) return go(home("?error=Bad+state"), { "Set-Cookie": CLEAR_STATE });
  if (q.get("error") === "access_denied") return go(home("?denied=1"), { "Set-Cookie": CLEAR_STATE });
  const { status, data } = await sml("/token", { method: "POST", body: { code: q.get("code") } });
  return go(status === 200 ? home() : home("?error=" + encodeURIComponent(String(data.error ?? "Could not connect"))), { "Set-Cookie": CLEAR_STATE });
}
