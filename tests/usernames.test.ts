import { afterAll, beforeAll, expect, test } from "vitest";
import { startTestDb } from "@/lib/testing";
import { usernameProblem, usernameAvailable, resolveUsername, renameUsername } from "@/lib/usernames";
import { listCatalog } from "@/lib/catalog";

let t: Awaited<ReturnType<typeof startTestDb>>;
let ada: string, bob: string;
beforeAll(async () => {
  t = await startTestDb();
  [{ id: ada }] = await t.sql`insert into users (email) values ('ada@x.com') returning id`;
  [{ id: bob }] = await t.sql`insert into users (email) values ('bob@x.com') returning id`;
  await t.sql`insert into creators (user_id, username) values (${ada}, 'ada'), (${bob}, 'bob_1')`;
});
afterAll(async () => { await t.stop(); });

test("usernameProblem validates shape and reserved names", () => {
  expect(usernameProblem("ab")).not.toBeNull();
  expect(usernameProblem("Ada_99")).toBeNull();
  expect(usernameProblem("admin")).not.toBeNull();
  expect(usernameProblem("adé")).not.toBeNull();
});

test("rename keeps old name as redirect and unavailable; case-insensitive", async () => {
  await t.sql.begin((tx) => renameUsername(tx, ada, "ada_x"));
  expect(await resolveUsername("ada")).toEqual({ username: "ada_x", redirected: true });
  expect(await resolveUsername("ADA_X")).toEqual({ username: "ada_x", redirected: false });
  expect(await resolveUsername("nobody")).toBeNull();
  expect(await usernameAvailable("ada")).toBe(false);
  expect(await usernameAvailable("fresh_name")).toBe(true);
});

test("rename rules: others' names and history blocked, own history reclaimable", async () => {
  await expect(t.sql.begin((tx) => renameUsername(tx, bob, "ada"))).rejects.toThrow();
  await expect(t.sql.begin((tx) => renameUsername(tx, bob, "admin"))).rejects.toThrow();
  await t.sql.begin((tx) => renameUsername(tx, ada, "ada"));
  expect(await resolveUsername("ada")).toEqual({ username: "ada", redirected: false });
  expect(await resolveUsername("ada_x")).toEqual({ username: "ada", redirected: true });
});

test("listCatalog nests children under top-level items", async () => {
  const c = await listCatalog();
  expect(c.length).toBe(10);
  expect(c.find((i) => i.id === "malt")!.children.map((x) => x.id)).toEqual(["malt-classic", "malt-dark", "malt-gold"]);
});
