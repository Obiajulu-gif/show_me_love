/** A post-login destination is honoured only if it is a same-origin path under /connect/authorize. */
export function safeNext(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 2000 || !v.startsWith("/connect/authorize") || /[\\\x00-\x1f\x7f]/.test(v)) return null;
  try {
    const u = new URL(v, "http://local.invalid");
    return u.origin === "http://local.invalid" && u.pathname === "/connect/authorize" ? u.pathname + u.search : null;
  } catch {
    return null;
  }
}
