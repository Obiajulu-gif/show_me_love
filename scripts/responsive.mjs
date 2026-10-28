// 375 px responsive pass: screenshots of the key screens and a horizontal-overflow check on each.
//   BASE_URL=http://localhost:3000 node scripts/responsive.mjs   (server in practice mode, `npm run dev`)
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = fileURLToPath(new URL("../docs/screenshots/375/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const ts = Date.now();
const name = `resp_${ts}`;
const json = { "content-type": "application/json" };

const browser = await chromium.launch();
const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.setDefaultTimeout(20_000);
const bad = [];

async function shot(label, { full = true } = {}) {
  await page.waitForTimeout(400);
  const o = await page.evaluate(() => {
    const w = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.right > w + 1 && !e.closest("pre, [data-allow-scroll]") && getComputedStyle(e).position !== "fixed";
    }).slice(0, 4).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)} right=${Math.round(e.getBoundingClientRect().right)}`);
    return { sw: document.documentElement.scrollWidth, w, wide };
  });
  const over = o.sw > o.w;
  console.log(`${over ? "OVERFLOW" : "ok      "} ${label} (scrollWidth ${o.sw} / ${o.w})${o.wide.length ? " " + o.wide.join("; ") : ""}`);
  if (over) bad.push(label);
  await page.screenshot({ path: `${OUT}${label}.png`, fullPage: full });
}

try {
  await page.goto("/"); await shot("1-landing");

  let r = await ctx.request.post("/api/auth/signup", { headers: json, data: { email: `${name}@show-me-love.test`, password: `Resp-${ts}-pw` } });
  if (!r.ok()) throw new Error(`signup ${r.status()}`);
  await page.goto("/onboarding");
  await page.getByLabel("Username").fill(name);
  await expect(page.getByText("Available")).toBeVisible();
  await page.getByRole("button", { name: "Create my page" }).click();
  await page.waitForURL(/\/dashboard$/);

  await page.goto(`/@${name}`); await shot("2-public-creator");

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("complementary", { name: "Menu" })).toBeVisible();
  await shot("3-dashboard-drawer", { full: false });
  await page.getByRole("button", { name: "Close menu" }).click();

  await page.goto("/dashboard/withdrawals");
  await page.getByRole("button", { name: "Make a withdrawal" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await shot("4-withdraw-modal", { full: false });

  r = await ctx.request.post("/api/goals", { headers: json, data: { title: "New camera", currency: "NGN", target: 100000, suggested: 2000 } });
  if (!r.ok()) throw new Error(`goal ${r.status()}`);
  await page.goto(`/@${name}/goals/new-camera`); await shot("5-goal-page");

  await page.goto("/dashboard/share"); await shot("6-share");
  await page.goto("/dashboard/share?tab=apps"); await shot("6b-share-apps");

  r = await ctx.request.post("/api/developers/apps", { headers: json, data: { name: "Resp App", mode: "sandbox", redirectUris: ["http://localhost:4999/cb"] } });
  const app = (await r.json()).app;
  r = await ctx.request.post(`/api/developers/apps/${app.id}/keys`, { headers: json, data: {} });
  const key = (await r.json()).key;
  await page.goto("/dashboard/developers?mode=sandbox");
  await page.getByRole("tab", { name: "Sandbox" }).click();
  await shot("7-developers");
  await page.getByRole("button", { name: "Integration guide" }).click();
  await shot("7b-developers-guide", { full: false });

  const s = await fetch(`${BASE}/api/connect/sessions`, {
    method: "POST", headers: { ...json, Authorization: `Bearer ${key}`, "X-Client-Id": app.clientId ?? app.client_id },
    body: JSON.stringify({ user_ref: "u1", redirect_uri: "http://localhost:4999/cb" }),
  }).then((x) => x.json());
  await page.goto(s.authorize_url); await shot("8-authorize");

  if (bad.length) { console.error(`Horizontal overflow on: ${bad.join(", ")}`); process.exitCode = 1; } else console.log("RESPONSIVE OK");
} catch (e) {
  console.error(`RESPONSIVE FAILED: ${e.message}\npage: ${page.url()}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
