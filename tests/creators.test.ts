import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestDb } from "@/lib/testing";
import { createCreator, getCreatorByUser, getCreatorByUsername, updateCreator } from "@/lib/creators";
import { saveUpload } from "@/lib/uploads";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string;
beforeAll(async () => {
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  await createCreator(ada, { username: "ada_bakes", treatId: "zobo" });
});
afterAll(async () => { await t.stop(); });

test("updateCreator rejects bad price and presets", async () => {
  await expect(updateCreator(ada, { unit_price_ngn: 50 })).rejects.toThrow("Price must be between ₦100 and ₦1,000,000.");
  await expect(updateCreator(ada, { presets: [0] })).rejects.toThrow(/Presets/);
  await expect(updateCreator(ada, { presets: [2, 2] })).rejects.toThrow(/Presets/);
  await expect(updateCreator(ada, { bio: "x".repeat(281) })).rejects.toThrow(/Bio/);
  await expect(updateCreator(ada, { socials: { a: "http://x.com" } })).rejects.toThrow(/https/);
  await expect(updateCreator(ada, { birthday_mode: "nope" as never })).rejects.toThrow(/Birthday/);
});

test("updateCreator accepts a valid patch and lookups work", async () => {
  const c = await updateCreator(ada, { display_name: "Ada B", unit_price_ngn: 750, presets: [1, 2, 10], bio: "hi", birthday_mode: "show_day", socials: { x: "https://x.com/ada" } });
  expect(c).toMatchObject({ displayName: "Ada B", unitPriceNgn: 750, presets: [1, 2, 10], bio: "hi", birthdayMode: "show_day", socials: { x: "https://x.com/ada" } });
  expect((await getCreatorByUser(ada))?.displayName).toBe("Ada B");
  expect((await getCreatorByUsername("ADA_BAKES"))?.userId).toBe(ada);
  expect(await getCreatorByUser("00000000-0000-0000-0000-000000000000")).toBeNull();
});

test("username change records history", async () => {
  const c = await updateCreator(ada, { username: "ada_new" });
  expect(c.username).toBe("ada_new");
  const rows = await t.sql`select old_username from username_history where user_id = ${ada}`;
  expect(rows.map((r) => r.old_username)).toEqual(["ada_bakes"]);
});

test("saveUpload rejects gif and oversize cover", async () => {
  await expect(saveUpload(new File([new Uint8Array(10)], "a.gif", { type: "image/gif" }), "avatar")).rejects.toThrow(/PNG, JPEG or WebP/);
  await expect(saveUpload(new File([new Uint8Array(6 * 1024 * 1024)], "c.png", { type: "image/png" }), "cover")).rejects.toThrow(/5 MB/);
});
