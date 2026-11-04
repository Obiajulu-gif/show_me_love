// Fixed-IP relay for Roqqu API Service (RAS).
//
// Roqqu's Cloudflare edge challenges calls from cloud hosts such as Vercel.
// This relay runs on a host with a static outbound IP that Roqqu allowlists;
// the app points ROQQU_BASE_URL at it and sends PROXY_TOKEN in x-proxy-token.
// It forwards only /v1/* to service.roqqu.com and passes the RAS key headers
// through untouched, so it never holds a Roqqu key itself.
import http from "node:http";

const UPSTREAM = process.env.UPSTREAM || "https://service.roqqu.com";
const TOKEN = process.env.PROXY_TOKEN;
const PORT = Number(process.env.PORT || 8080);
const PASS = ["accept", "content-type", "x-api-key", "x-staging-api-key"];

if (!TOKEN || TOKEN.length < 24) {
  console.error("Set PROXY_TOKEN to a random string of at least 24 characters.");
  process.exit(1);
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

http
  .createServer(async (req, res) => {
    if (req.url === "/healthz") return send(res, 200, { ok: true });
    if (req.headers["x-proxy-token"] !== TOKEN) return send(res, 401, { status: "fail", message: "proxy token missing or wrong" });
    if (!req.url?.startsWith("/v1/")) return send(res, 404, { status: "fail", message: "only /v1/* is relayed" });
    if (!["GET", "POST", "DELETE"].includes(req.method)) return send(res, 405, { status: "fail", message: "method not allowed" });

    const headers = {};
    for (const h of PASS) if (req.headers[h]) headers[h] = req.headers[h];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    try {
      const up = await fetch(UPSTREAM + req.url, { method: req.method, headers, body: req.method === "GET" ? undefined : body });
      const text = await up.text();
      res.writeHead(up.status, { "content-type": up.headers.get("content-type") || "application/json" });
      res.end(text);
    } catch (err) {
      console.error(`relay ${req.method} ${req.url} failed:`, err instanceof Error ? err.message : err);
      send(res, 502, { status: "fail", message: "Roqqu unreachable from relay" });
    }
  })
  .listen(PORT, () => console.log(`RAS relay on :${PORT} -> ${UPSTREAM}`));
