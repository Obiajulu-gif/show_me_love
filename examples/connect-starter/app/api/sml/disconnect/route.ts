import { demoUser, go, home } from "../../../../lib/demo";
import { sml } from "../../../../lib/sml";

export async function POST(req: Request) {
  const userRef = demoUser(req);
  if (userRef) await sml("/disconnect", { method: "POST", body: { user_ref: userRef } });
  return go(home());
}
