import { afterAll, beforeAll, expect, test } from "vitest";

import { startTestDb } from "@/lib/testing";
import { hit } from "@/lib/ratelimit";
import {
  getActiveCampaignByCreator, getCampaignByCreator, recordStamp, saveCampaign,
  sanitizeHeadline, sanitizeStampHandle, sanitizeStampName, stampStats, StampInputError,
} from "@/lib/stamps";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('stamps@x.com') returning id`;
  await t.sql`insert into creators (user_id, username) values (${ada}, 'stamp_ada')`;
});
afterAll(async () => { await t.stop(); });

test("sanitizers trim, collapse and validate", () => {
  expect(sanitizeStampName("  Ada   Lovelace ")).toBe("Ada Lovelace");
  expect(sanitizeStampName("Ada\u0000\nLovelace")).toBe("Ada Lovelace");
  expect(sanitizeStampName(undefined)).toBe("");
  expect(() => sanitizeStampName("x".repeat(33))).toThrow(StampInputError);
  expect(() => sanitizeStampName(5)).toThrow(/text/);

  expect(sanitizeStampHandle(" @Ada.Bakes ")).toBe("Ada.Bakes");
  expect(sanitizeStampHandle("@@ada")).toBe("ada");
  expect(sanitizeStampHandle("")).toBe("");
  expect(() => sanitizeStampHandle("bad handle")).toThrow(/Handles/);
  expect(() => sanitizeStampHandle("x".repeat(25))).toThrow(/Handles/);

  expect(sanitizeHeadline("  I   support  ")).toBe("I support");
  expect(() => sanitizeHeadline("   ")).toThrow(/headline/);
  expect(() => sanitizeHeadline("x".repeat(41))).toThrow(/40/);
});

test("saveCampaign creates defaults, then updates in place", async () => {
  const first = await saveCampaign(ada, {}, "sage");
  expect(first).toMatchObject({ headline: "I support", style: "sage", active: false });
  expect(await getCampaignByCreator(ada)).toMatchObject({ id: first.id });

  const second = await saveCampaign(ada, { headline: "  I stand with  ", style: "cocoa", active: true });
  expect(second).toMatchObject({ id: first.id, headline: "I stand with", style: "cocoa", active: true });
  const [{ n }] = await t.sql`select count(*)::int as n from stamp_campaigns where creator_id = ${ada}`;
  expect(n).toBe(1);
});

test("getActiveCampaignByCreator hides a paused campaign", async () => {
  expect((await getActiveCampaignByCreator(ada))?.style).toBe("cocoa");
  await saveCampaign(ada, { active: false });
  expect(await getActiveCampaignByCreator(ada)).toBeNull();
  expect((await getCampaignByCreator(ada))?.active).toBe(false);
});

test("saveCampaign rejects a bad style or switch without writing", async () => {
  await expect(saveCampaign(ada, { style: "blue" })).rejects.toThrow(/style/);
  await expect(saveCampaign(ada, { active: "yes" })).rejects.toThrow(/switch/);
  expect((await getCampaignByCreator(ada))?.style).toBe("cocoa");
});

test("recordStamp counts and stats split the week", async () => {
  const campaign = await saveCampaign(ada, { active: true });
  expect(await recordStamp({ campaignId: campaign.id, creatorId: ada, name: "First", handle: "first" })).toBe(1);
  await t.sql`update stamps set created_at = now() - interval '8 days' where visitor_name = 'First'`;
  expect(await recordStamp({ campaignId: campaign.id, creatorId: ada, name: "", handle: "" })).toBe(2);

  const stats = await stampStats(ada);
  expect(stats.total).toBe(2);
  expect(stats.week).toBe(1);
  expect(stats.recent.map((r) => r.name)).toEqual([null, "First"]);
  expect(stats.recent[1]).toMatchObject({ handle: "first" });

  const [row] = await t.sql`select visitor_name, visitor_handle from stamps where campaign_id = ${campaign.id} order by created_at desc limit 1`;
  expect(row).toEqual({ visitor_name: null, visitor_handle: null });
});

test("rate limiting is a fixed window", async () => {
  expect(await hit("stamp:test", 2, 60)).toBe(true);
  expect(await hit("stamp:test", 2, 60)).toBe(true);
  expect(await hit("stamp:test", 2, 60)).toBe(false);
});
