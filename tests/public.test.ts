import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestDb } from "@/lib/testing";
import { createCreator } from "@/lib/creators";
import { publicWall } from "@/lib/stats";
import { CreatorPage, type PageView } from "@/components/CreatorPage";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });

const pay = (ref: string, status: string, pub: boolean, name: string | null, msg: string | null) =>
  t.sql`insert into payments (ref, kind, creator_id, supporter_name, message, is_public, quantity, status)
        values (${ref}, 'treat', ${ada}, ${name}, ${msg}, ${pub}, 2, ${status})`;

test("publicWall keeps only successful, public payments with a message", async () => {
  await pay("p1", "successful", true, "Tunde", "great");
  await pay("p2", "successful", true, "", "anon note");
  await pay("p3", "successful", false, "Sneaky", "private");
  await pay("p4", "pending", true, "Pend", "pending");
  await pay("p5", "failed", true, "Fail", "failed");
  await pay("p6", "successful", true, "NoMsg", null);
  const w = await publicWall(ada);
  expect(w.map((e) => e.name).sort()).toEqual(["Someone", "Tunde"]);
  expect(w.find((e) => e.name === "Tunde")).toMatchObject({ id: "p1", message: "great", quantity: 2 });
});

test("wall messages render escaped", () => {
  const c: PageView = {
    username: "ada_bakes", displayName: "Ada", bio: "", photoUrl: null, treatName: "Zobo", treatImage: "", unitPriceNgn: 500,
    presets: [1], thankYouText: "", tagline: "", accent: "honey", header: "default", coverUrl: null, socials: [],
  };
  const html = renderToStaticMarkup(createElement(CreatorPage, {
    creator: c, mode: "live", payments: [{ id: "x", name: "Eve", message: "<img src=x onerror=alert(1)>", quantity: 1, at: new Date() }],
  }));
  expect(html).toContain("&lt;img");
  expect(html).not.toContain("<img src=x");
});

import { toPageView, type PageViewInput } from "@/lib/pageView";
const base: PageViewInput = { username: "a", displayName: "A", bio: "", photoUrl: null, treatId: "zobo", unitPriceNgn: 500, presets: [1, 3], thankYouText: "", socials: [] };
const treats = { zobo: { name: "Zobo", image: "/treats/zobo.svg" } };

test("toPageView: catalog treat, custom fallback, defaults", () => {
  expect(toPageView(base, treats)).toMatchObject({ treatName: "Zobo", treatImage: "/treats/zobo.svg", tagline: "", accent: "honey", header: "default", coverUrl: null });
  expect(toPageView({ ...base, treatId: "custom", customTreat: { name: "Chapman" } }, treats)).toMatchObject({ treatName: "Chapman", treatImage: "" });
  expect(toPageView({ ...base, treatId: "custom", customTreat: null }, treats).treatName).toBe("Treat");
  expect(toPageView({ ...base, presets: [], unitPriceNgn: NaN }, treats)).toMatchObject({ presets: [1], unitPriceNgn: 0 });
});
