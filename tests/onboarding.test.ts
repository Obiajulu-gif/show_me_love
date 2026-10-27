import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestDb } from "@/lib/testing";
import { createCreator } from "@/lib/creators";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string, bob: string, cy: string;
beforeAll(async () => {
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bob }] = await t.sql`insert into users (email) values ('bob@x.com') returning id`;
  [{ id: cy }] = await t.sql`insert into users (email) values ('cy@x.com') returning id`;
});
afterAll(async () => { await t.stop(); });

test("createCreator applies defaults and lowercases the username", async () => {
  const c = await createCreator(ada, { username: "Ada_Bakes", treatId: "zobo" });
  expect(c).toMatchObject({
    userId: ada, username: "ada_bakes", displayName: "Ada_Bakes".toLowerCase(), treatId: "zobo", customTreat: null,
    unitPriceNgn: 500, presets: [1, 3, 5],
    thankYouText: "Thanks for the treat. It means a lot.",
    shareMessage: "Feeling good today. Make it better: buy me a treat! 😊",
    pageStyle: { accent: "honey", tagline: "A little love. A lot of possibility.", header: "default" },
  });
});

test("custom treat is stored", async () => {
  const c = await createCreator(cy, { username: "cy_x", treatId: "custom", customTreat: { name: "Puff puff", emoji: "🍩" } });
  expect(c.customTreat).toEqual({ name: "Puff puff", emoji: "🍩" });
});

test("taken username throws friendly error; second page for same user throws", async () => {
  await expect(createCreator(bob, { username: "ADA_bakes", treatId: "suya" })).rejects.toThrow("That username is taken.");
  await expect(createCreator(ada, { username: "ada_two", treatId: "suya" })).rejects.toThrow("You already have a page.");
  await expect(createCreator(bob, { username: "admin", treatId: "suya" })).rejects.toThrow("reserved");
});
