// End-to-end smoke test of the whole money loop against a running app in practice mode.
//   BASE_URL=http://localhost:3000 CRON_SECRET=... node scripts/smoke.mjs
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
  let paid = false;
  for (let i = 0; i < 16 && !paid; i++) {
    const cron = await ctx.request.get("/api/cron/expire", { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    if (!cron.ok()) throw new Error(`cron returned ${cron.status()}`);
    await page.goto("/dashboard/withdrawals");
    paid = (await page.getByText("Paid", { exact: true }).count()) > 0;
    if (!paid) await page.waitForTimeout(15_000);
  }
  if (!paid) throw new Error("Withdrawal never reached Paid.");

  console.log("SMOKE OK");
} catch (e) {
  console.error(`SMOKE FAILED at step: ${step}\n${e.message}`);
  const alerts = await page?.locator("[role=alert]:not(#__next-route-announcer__), [role=dialog]").allInnerTexts().catch(() => []);
  console.error(`page: ${page?.url()}${alerts?.length ? ` alert: ${alerts.join(" | ")}` : ""}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
