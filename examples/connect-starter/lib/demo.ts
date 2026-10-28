/** DEMO ONLY: a fake login. Replace `demoUser` with your real session lookup. */
export const DEMO_USER_ID = "demo-user-42";

export function getCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** The user_ref always comes from here (the server's own session), never from the request body or query. */
export const demoUser = (req: Request) => (getCookie(req, "demo_user") ? DEMO_USER_ID : null);

/** The state sent out must come back unchanged. */
export const stateOk = (saved: string | undefined, got: string | null) => !!saved && got === saved;

export const home = (query = "") => process.env.APP_ORIGIN + "/" + query;
export const go = (url: string, headers: Record<string, string> = {}) => new Response(null, { status: 303, headers: { Location: url, ...headers } });
