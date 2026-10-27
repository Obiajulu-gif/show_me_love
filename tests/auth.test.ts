import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { startTestDb } from "@/lib/testing";
import { AuthError, signIn, signUp } from "@/lib/auth";
import { consumeCode, issueCode } from "@/lib/codes";
import { hit } from "@/lib/ratelimit";

let t: Awaited<ReturnType<typeof startTestDb>>;
beforeAll(async () => {
  vi.stubEnv("SESSION_SECRET", "x".repeat(40));
  vi.stubEnv("ADMIN_EMAILS", "boss@x.com, other@x.com");
  t = await startTestDb();
});
afterAll(async () => { await t.stop(); });

test("signUp then signIn; wrong password and duplicate email give user-facing errors", async () => {
  const { id } = await signUp("A@x.com", "password1");
  expect((await signIn("a@x.com", "password1")).id).toBe(id);
  await expect(signIn("a@x.com", "nope-nope")).rejects.toThrow(new AuthError("Email or password is wrong."));
  await expect(signIn("ghost@x.com", "password1")).rejects.toThrow("Email or password is wrong.");
  await expect(signUp("a@x.com", "password1")).rejects.toThrow(new AuthError("That email already has an account."));
});

test("ADMIN_EMAILS get role admin", async () => {
  const { id } = await signUp("boss@x.com", "password1");
  expect((await t.sql`select role from users where id = ${id}`)[0].role).toBe("admin");
  const o = await signUp("plain@x.com", "password1");
  expect((await t.sql`select role from users where id = ${o.id}`)[0].role).toBe("creator");
});

test("codes are single use, expire, and only the hash is stored", async () => {
  const { id } = await signUp("c@x.com", "password1");
  const code = await issueCode(id, "login", 15);
  expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect((await t.sql`select count(*)::int n from one_time_codes where code_hash = ${code}`)[0].n).toBe(0);
  expect(await consumeCode(null, "login", code)).toBe(id);
  expect(await consumeCode(null, "login", code)).toBeNull();
  const old = await issueCode(id, "login", -1);
  expect(await consumeCode(null, "login", old)).toBeNull();
  const w = await issueCode(id, "withdrawal", 10);
  expect(w).toMatch(/^\d{6}$/);
  expect(await consumeCode(crypto.randomUUID(), "withdrawal", w)).toBeNull();
  expect(await consumeCode(id, "withdrawal", w)).toBe(id);
});

test("hit allows limit then blocks", async () => {
  const r: boolean[] = [];
  for (let i = 0; i < 4; i++) r.push(await hit("k1", 3, 60));
  expect(r).toEqual([true, true, true, false]);
  expect(await hit("k2", 3, 60)).toBe(true);
});
