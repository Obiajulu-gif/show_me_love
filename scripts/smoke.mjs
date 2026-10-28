// End-to-end smoke test of the whole money loop against a running app in practice mode.
//   BASE_URL=http://localhost:3000 CRON_SECRET=... node scripts/smoke.mjs
// Covers the money loop, goals, group support and the Connect API (set SMOKE_FAST=1 to skip the 2-minute payout wait while developing).
// The server must run with RAS_MODE=practice and ADMIN_EMAILS including smoke+admin@show-me-love.test.
import { chromium, expect as pwExpect } from "@playwright/test";

const expect = pwExpect.configure({ timeout: 20_000 });
const BASE = process.env.BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAIL = "smoke+admin@show-me-love.test";
const PASSWORD = `Smoke-${Date.now()}-pw`;
const ts = Date.now();
const username = `smoke_${ts}`;
const email = `smoke+${ts}@show-me-love.test`;
const wallet = "0x" + "ab12cd34ef".repeat(4);

if (!CRON_SECRET) { console.error("Set CRON_SECRET (the same value the server uses)."); process.exit(1); }

// SMOKE_FAST=1 skips the two-minute payout wait (development only; the real run must not set it).
const FAST = process.env.SMOKE_FAST === "1";

// Clicks "Simulate payment" until the success locator shows (a click before hydration does nothing, esp. in dev).
const simulateUntil = (p, done) => expect(async () => {
  const b = p.getByRole("button", { name: "Simulate payment" });
  if (await b.count()) await b.click({ timeout: 3000 });
  await expect(done).toBeVisible({ timeout: 4000 });
}).toPass({ timeout: 30_000 });

let step = "start";
const t = (s) => { step = s; console.log(`- ${s}`); };

const browser = await chromium.launch();
let page;
try {
  const ctx = await browser.newContext({ baseURL: BASE });
  page = await ctx.newPage();
  page.setDefaultTimeout(20_000);

  t("claim username on landing page");
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Claim my page" }).click();

  t("sign up");
  await page.waitForURL(/\/signup/);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign up" }).click();

  t("onboarding");
  await page.waitForURL(/\/onboarding/);
  await expect(page.getByLabel("Username")).toHaveValue(username);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create my page" }).click();
  await page.waitForURL(/\/dashboard$/);

  t("edit price");
  await page.goto("/dashboard/your-page");
  await page.getByRole("tab", { name: "Treats" }).click();
  await page.locator("#price").fill("5000");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Saved.")).toBeVisible();

  t("open public page and buy 1 treat");
  await page.goto(`/@${username}`);
  await page.getByLabel("Your name").fill("Smoke Supporter");
  await page.getByLabel("Your email").fill("supporter@show-me-love.test");
  await page.getByLabel("Message").fill("Smoke test treat");
  await page.getByRole("button", { name: /^Send .*₦5,000/ }).click();

  t("thanks page, simulate payment");
  await page.waitForURL(/\/thanks/);
  await page.getByRole("button", { name: "Simulate payment" }).click();
  await expect(page.getByRole("heading", { name: "Your love landed!" })).toBeVisible();

  t("dashboard shows 1 treat");
  await page.goto("/dashboard");
  await expect(page.getByText("Treats received").locator("xpath=following-sibling::p")).toHaveText("1");
  const balText = await page.getByText("Available balance").locator("xpath=following-sibling::p").innerText();
  const balance = Number(/\$([\d.]+)/.exec(balText)?.[1]);
  if (!(balance > 1)) throw new Error(`Unexpected balance: ${balText}`);
  const amount = (balance - 0.5).toFixed(2);

  t("set USDT BEP20 destination");
  await page.goto("/dashboard/withdrawals");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("Network").selectOption("bep20");
  await page.getByLabel("Wallet address").fill(wallet);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("BEP20 0xab12")).toBeVisible();

  t(`request code and withdraw ${amount} USDT`);
  await page.getByRole("button", { name: "Make a withdrawal" }).click();
  await page.getByLabel("Amount (USDT)").fill(amount);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByLabel("6-digit code")).toHaveValue(/^\d{6}$/); // dev hint fills it in
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByText("In review")).toBeVisible();

  t("admin approves in /admin/withdrawals");
  const actx = await browser.newContext({ baseURL: BASE });
  const apage = await actx.newPage();
  apage.setDefaultTimeout(20_000);
  apage.on("dialog", (d) => d.accept());
  const json = { "content-type": "application/json" };
  let r = await actx.request.post("/api/auth/signup", { headers: json, data: { email: ADMIN_EMAIL, password: PASSWORD } });
  if (!r.ok()) { // admin already exists from an earlier run: its password is not known, so use the magic-link dev route instead
    r = await actx.request.post("/api/auth/magic", { headers: json, data: { email: ADMIN_EMAIL } });
    const { devLink } = await r.json();
    if (!devLink) throw new Error("Admin exists and no dev sign-in link was offered.");
    await apage.goto(devLink);
  }
  await apage.goto("/admin/withdrawals");
  const row = apage.locator("tr", { hasText: `@${username}` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Approve and send" }).click();
  await expect(apage.locator("tr", { hasText: `@${username}` })).toHaveCount(0);

  // The cron only settles sends that have been processing for 2 minutes, so call it every 15 s until the row turns Paid.
  t("cron settles the send (takes about 2 minutes)");
  let paid = FAST;
  for (let i = 0; i < 16 && !paid; i++) {
    const cron = await ctx.request.get("/api/cron/expire", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    if (!cron.ok()) throw new Error(`cron returned ${cron.status()}`);
    await page.goto("/dashboard/withdrawals");
    paid = (await page.getByText("Paid", { exact: true }).count()) > 0;
    if (!paid) await page.waitForTimeout(15_000);
  }
  if (!paid) throw new Error("Withdrawal never reached Paid.");


  // ---- Tier 2: goals, group support, Connect API ----------------------------------------------
  const makeCreator = async (name) => {
    const c = await browser.newContext({ baseURL: BASE });
    const p = await c.newPage();
    p.setDefaultTimeout(20_000);
    const r = await c.request.post("/api/auth/signup", { headers: json, data: { email: `${name}@show-me-love.test`, password: PASSWORD } });
    if (!r.ok()) throw new Error(`signup ${name} failed: ${r.status()}`);
    await p.goto("/onboarding");
    await p.getByLabel("Username").fill(name);
    await expect(p.getByText("Available")).toBeVisible();
    await p.getByRole("button", { name: "Create my page" }).click();
    await p.waitForURL(/\/dashboard$/);
    return { ctx: c, page: p, name };
  };

  t("create a goal");
  await page.goto("/dashboard/goals");
  await page.getByRole("button", { name: "Create your first goal" }).click();
  const drawer = page.getByRole("dialog", { name: "New goal" });
  await drawer.getByLabel("Title").fill("New camera");
  await drawer.getByLabel("Target", { exact: true }).fill("10000");
  await drawer.getByLabel("Suggested contribution").fill("2000");
  await drawer.getByRole("button", { name: "Save goal" }).click();
  await expect(page.getByRole("heading", { name: "New camera" })).toBeVisible();

  t("contribute to the goal, simulate payment");
  await page.goto(`/@${username}/goals/new-camera`);
  await page.getByLabel("Your name").fill("Goal Supporter");
  await page.getByLabel("Your email").fill("goal@show-me-love.test");
  await page.getByRole("button", { name: /^Contribute .*₦2,000/ }).click();
  await simulateUntil(page, page.getByRole("heading", { name: "Your love landed!" }));

  t("dashboard goal progress shows the amount");
  await page.goto("/dashboard/goals");
  await expect(page.getByText(/₦2,000 of ₦10,000 · 1 contribution/)).toBeVisible();

  t("sign up two more creators");
  const second = await makeCreator(`smoke_b_${ts}`);
  const third = await makeCreator(`smoke_c_${ts}`);

  t("pay a group of two creators, simulate");
  await page.goto("/dashboard/group");
  await page.getByLabel("Usernames").fill(`@${second.name}, ${third.name}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove ${second.name}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Remove ${third.name}` })).toBeVisible();
  await page.getByLabel("Total").fill("2000");
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await simulateUntil(page, page.getByRole("heading", { name: "Your group got your love!" }));

  t("both recipients see a 'group' treat row");
  for (const who of [second, third]) {
    await who.page.goto("/dashboard/treats");
    await expect(who.page.locator("td span", { hasText: /^group$/ })).toHaveCount(1);
  }

  t("create a sandbox app and an API key in Developers");
  const redirectUri = "http://localhost:4999/api/sml/callback";
  await page.goto("/dashboard/developers");
  await page.getByRole("button", { name: "Create an app" }).click();
  const appDialog = page.getByRole("dialog", { name: "Create an app" });
  await appDialog.getByLabel("App name").fill("Smoke Sandbox App");
  await appDialog.getByRole("tab", { name: "Sandbox" }).click();
  await appDialog.getByLabel(/Redirect links/).fill(redirectUri);
  await appDialog.getByRole("button", { name: "Create app" }).click();
  await expect(page.getByRole("heading", { name: "Smoke Sandbox App" })).toBeVisible();
  const clientId = (await page.locator("code", { hasText: /^sml_app_/ }).first().innerText()).trim();
  await page.getByRole("button", { name: "Generate key" }).click();
  const apiKey = (await page.getByTestId("issued-key").innerText()).trim();
  if (!apiKey || !clientId) throw new Error("No client id or key was shown.");
  await page.getByRole("button", { name: "I've copied it" }).click();

  t("Connect flow: sessions, authorize, token, connection");
  const sml = async (path, init = {}) => {
    const res = await fetch(`${BASE}/api/connect${path}`, {
      method: init.method ?? "GET",
      headers: { Authorization: `Bearer ${apiKey}`, "X-Client-Id": clientId, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  };
  const userRef = `user-${ts}`;
  const state = `state-${ts}`;
  const sess = await sml("/sessions", { method: "POST", body: { user_ref: userRef, redirect_uri: redirectUri, state } });
  if (sess.status !== 200 || !sess.data.authorize_url) throw new Error(`sessions returned ${sess.status}: ${JSON.stringify(sess.data)}`);
  // Nothing listens on :4999: answer the redirect ourselves so the navigation URL (with the code) is readable.
  await ctx.route("http://localhost:4999/**", (route) => route.fulfill({ status: 200, contentType: "text/plain", body: "callback" }));
  await page.goto(sess.data.authorize_url);
  await expect(page.getByRole("heading", { name: /Connect Smoke Sandbox App/ })).toBeVisible();
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  await page.waitForURL(/localhost:4999/);
  const cb = new URL(page.url());
  const code = cb.searchParams.get("code");
  if (!code || cb.searchParams.get("state") !== state) throw new Error(`Bad callback: ${page.url()}`);
  const tok = await sml("/token", { method: "POST", body: { code } });
  if (tok.status !== 200 || tok.data.connected !== true) throw new Error(`token returned ${tok.status}: ${JSON.stringify(tok.data)}`);
  const conn = await sml(`/connection?user_ref=${encodeURIComponent(userRef)}`);
  if (conn.status !== 200 || !String(conn.data.support_url).endsWith(`/@${username}`)) throw new Error(`connection returned ${conn.status}: ${JSON.stringify(conn.data)}`);

  t("revoke from Share, connection returns 404");
  await page.goto("/dashboard/share?tab=apps");
  await page.getByRole("button", { name: "Revoke Smoke Sandbox App" }).click();
  await expect(page.getByText("No apps are connected yet.")).toBeVisible();
  const gone = await sml(`/connection?user_ref=${encodeURIComponent(userRef)}`);
  if (gone.status !== 404) throw new Error(`connection after revoke returned ${gone.status}`);

  console.log("SMOKE OK");
} catch (e) {
  console.error(`SMOKE FAILED at step: ${step}\n${e.message}`);
  const alerts = await page?.locator("[role=alert]:not(#__next-route-announcer__), [role=dialog]").allInnerTexts().catch(() => []);
  console.error(`page: ${page?.url()}${alerts?.length ? ` alert: ${alerts.join(" | ")}` : ""}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
