import { SignJWT } from "jose";
import { beforeAll, expect, test, vi } from "vitest";
import { devHint } from "@/lib/email";
import { pickIp } from "@/lib/http";
import { signSession, verifySession } from "@/lib/session";

const key = new TextEncoder().encode("s".repeat(40));
beforeAll(() => { vi.stubEnv("SESSION_SECRET", "s".repeat(40)); });

test("session round-trips, rejects tampered, expired and alg:none tokens", async () => {
  const t = await signSession("user-1");
  expect(await verifySession(t)).toBe("user-1");
  expect(await verifySession(t.slice(0, -2) + (t.endsWith("AA") ? "BB" : "AA"))).toBeNull();
  expect(await verifySession(undefined)).toBeNull();
  const expired = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("user-1").setIssuedAt(1000).setExpirationTime(2000).sign(key);
  expect(await verifySession(expired)).toBeNull();
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "user-1" })}.`;
  expect(await verifySession(none)).toBeNull();
});

test("devHint only shows in dev with no provider", () => {
  const none = { sent: false, via: "none" as const };
  vi.stubEnv("NODE_ENV", "development");
  expect(devHint(none, "v")).toBe("v");
  expect(devHint({ sent: true, via: "brevo" }, "v")).toBeUndefined();
  vi.stubEnv("BREVO_API_KEY", "k");
  expect(devHint({ sent: false, via: "brevo", error: "x" }, "v")).toBeUndefined();
  vi.stubEnv("NODE_ENV", "production");
  expect(devHint(none, "v")).toBeUndefined();
  vi.unstubAllEnvs();
});

test("pickIp prefers vercel header, x-real-ip, last x-forwarded-for hop, then local", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  expect(pickIp(h({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9, 3.3.3.3" }))).toBe("1.1.1.1");
  expect(pickIp(h({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9, 3.3.3.3" }))).toBe("2.2.2.2");
  expect(pickIp(h({ "x-forwarded-for": "9.9.9.9, 3.3.3.3" }))).toBe("3.3.3.3");
  expect(pickIp(h({}))).toBe("local");
});
