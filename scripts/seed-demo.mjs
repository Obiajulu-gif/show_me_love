// Fills a practice-mode app with a demo creator "demo" and three paid treats, through the app's own HTTP routes.
//   DEMO_PASSWORD=... BASE_URL=http://localhost:3000 node scripts/seed-demo.mjs
// Safe to run twice: existing account is logged into, and treats whose note is already on the page are skipped.
const BASE = process.env.BASE_URL || "http://localhost:3000";
const PASSWORD = process.env.DEMO_PASSWORD;
const EMAIL = "demo@show-me-love.test";
const USERNAME = "demo";
const BIO = "Baker of slow Sunday loaves and keeper of a very loud kettle. Every treat buys flour, and flour becomes bread for the street.";
const TREATS = [
  { quantity: 1, name: "Ifeoma", email: "ifeoma@show-me-love.test", message: "Your sourdough thread got me through finals week." },
  { quantity: 3, name: "Tunde", email: "tunde@show-me-love.test", message: "Three zobos for the three loaves I burned copying you." },
  { quantity: 2, name: "Marta", email: "marta@show-me-love.test", message: "Greetings from Cochabamba. The crumb shots are gorgeous." },
];

if (!PASSWORD) { console.error("Set DEMO_PASSWORD (the demo account's password). Refusing to run without it."); process.exit(1); }

let cookie = "";
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method, redirect: "manual",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  return { res, text: await res.text() };
}
const fail = (m) => { console.error(m); process.exit(1); };

// Only practice mode exposes /api/dev/simulate: 400 means "send a ref" (practice), 404 means test or live.
const probe = await api("/api/dev/simulate", { method: "POST", body: {} }).catch((e) => fail(`Cannot reach ${BASE}: ${e.message}`));
if (probe.res.status !== 400) fail(`${BASE} is not in practice mode (RAS_MODE=practice). Refusing to seed a real deployment.`);

let r = await api("/api/auth/signup", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
if (!r.res.ok) {
  r = await api("/api/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
  if (!r.res.ok) fail(`Could not sign up or log in as ${EMAIL}: ${r.text}`);
}
console.log("signed in as", EMAIL);

r = await api("/api/onboarding", { method: "POST", body: { username: USERNAME, treatId: "zobo" } });
console.log(r.res.ok ? `created page @${USERNAME}` : `page exists (${JSON.parse(r.text || "{}").error ?? r.res.status})`);

r = await api("/api/creator", { method: "PATCH", body: { bio: BIO, display_name: "Demo Baker" } });
if (!r.res.ok) fail(`Could not save the bio: ${r.text}`);

for (const t of TREATS) {
  const page = (await api(`/@${USERNAME}`)).text;
  if (page.includes(t.message)) { console.log(`skip ${t.name}: already on the page`); continue; }
  const c = await api("/api/checkout", { method: "POST", body: { username: USERNAME, quantity: t.quantity, name: t.name, email: t.email, message: t.message, isPublic: true } });
  const ref = JSON.parse(c.text || "{}").ref;
  if (!c.res.ok || !ref) fail(`Checkout failed for ${t.name}: ${c.text}`);
  const s = await api("/api/dev/simulate", { method: "POST", body: { ref } });
  if (!s.res.ok) fail(`Simulate failed for ${t.name}: ${s.text}`);
  console.log(`paid ${t.quantity} x treat from ${t.name}`);
}
console.log(`Done. Open ${BASE}/@${USERNAME}`);
