/** Server-only helper: every show-me-love call goes through here, so the key never reaches the browser. */
export async function sml(path: string, init: { method?: string; body?: unknown } = {}): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(process.env.SML_ORIGIN + "/api/connect" + path, {
    method: init.method ?? "GET",
    headers: {
      Authorization: "Bearer " + process.env.SML_API_KEY,
      "X-Client-Id": process.env.SML_CLIENT_ID ?? "",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}
