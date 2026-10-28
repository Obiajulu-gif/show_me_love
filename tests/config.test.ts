import { afterEach, describe, expect, test, vi } from "vitest";

import { POST as onboarding } from "../src/app/api/onboarding/route";
import { POST as reportRoute } from "../src/app/api/reports/route";
import { POST as uploads } from "../src/app/api/uploads/route";
import { POST as withdraw } from "../src/app/api/withdrawals/route";
import { POST as wcode } from "../src/app/api/withdrawals/code/route";
import { assertProductionConfig } from "../src/lib/config";
import { ConfigError, feeUsdt, platformFeeBps } from "../src/lib/money";
import { practiceEnabled, rasMode, RasConfigError } from "../src/lib/ras";
import { getRate, resetRateCache } from "../src/lib/rates";

vi.mock("../src/lib/ras", async (orig) => ({ ...(await orig<typeof import("../src/lib/ras")>()), ngnPerUsd: vi.fn() }));
import * as ras from "../src/lib/ras";

afterEach(() => { vi.unstubAllEnvs(); resetRateCache(); });

describe("rasMode in production", () => {
  test("no RAS_MODE throws", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RAS_MODE", ""); vi.stubEnv("RAS_TEST_KEY", "");
    expect(() => rasMode()).toThrow(RasConfigError);
    expect(practiceEnabled()).toBe(false);
  });
  test("practice needs ALLOW_PRACTICE=true", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RAS_MODE", "practice");
    expect(() => rasMode()).toThrow(RasConfigError);
    vi.stubEnv("ALLOW_PRACTICE", "true");
    expect(rasMode()).toBe("practice");
  });
  test("explicit test works; dev with no keys is practice", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("RAS_MODE", "test");
    expect(rasMode()).toBe("test");
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("RAS_MODE", ""); vi.stubEnv("RAS_TEST_KEY", ""); vi.stubEnv("RAS_LIVE_KEY", "");
    expect(rasMode()).toBe("practice");
    expect(practiceEnabled()).toBe(true);
  });
});

describe("assertProductionConfig", () => {
  const good = () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("PUBLIC_APP_URL", "https://x.app"); vi.stubEnv("SESSION_SECRET", "s".repeat(32));
    vi.stubEnv("BREVO_API_KEY", "k"); vi.stubEnv("ZEPTOMAIL_API_KEY", ""); vi.stubEnv("RAS_MODE", "test"); vi.stubEnv("PLATFORM_FEE_BPS", "");
  };
  test("passes when complete; ignored outside production", () => {
    good(); expect(() => assertProductionConfig()).not.toThrow();
    vi.stubEnv("NODE_ENV", "development"); vi.stubEnv("SESSION_SECRET", "");
    expect(() => assertProductionConfig()).not.toThrow();
  });
  test("lists every problem", () => {
    good();
    vi.stubEnv("PUBLIC_APP_URL", ""); vi.stubEnv("SESSION_SECRET", "short"); vi.stubEnv("BREVO_API_KEY", ""); vi.stubEnv("RAS_MODE", ""); vi.stubEnv("PLATFORM_FEE_BPS", "9999");
    expect(() => assertProductionConfig()).toThrow(/PUBLIC_APP_URL[\s\S]*SESSION_SECRET[\s\S]*email provider[\s\S]*RAS_MODE[\s\S]*PLATFORM_FEE_BPS/);
  });
});

describe("PLATFORM_FEE_BPS and getRate", () => {
  test("fee bps is an integer 0-2000, default 500", () => {
    vi.stubEnv("PLATFORM_FEE_BPS", "");
    expect(platformFeeBps()).toBe(500);
    for (const ok of ["0", "250", "2000"]) { vi.stubEnv("PLATFORM_FEE_BPS", ok); expect(platformFeeBps()).toBe(Number(ok)); }
    for (const bad of ["2001", "-1", "5.5", "abc", "1e3"]) { vi.stubEnv("PLATFORM_FEE_BPS", bad); expect(() => platformFeeBps()).toThrow(ConfigError); }
    vi.stubEnv("PLATFORM_FEE_BPS", "nope");
    expect(() => feeUsdt("1")).toThrow(ConfigError);
  });
  test("getRate rejects non-finite and non-positive rates", async () => {
    for (const bad of [0, -5, Infinity, NaN]) {
      resetRateCache();
      vi.mocked(ras.ngnPerUsd).mockResolvedValueOnce(bad);
      await expect(getRate()).rejects.toThrow();
    }
    vi.mocked(ras.ngnPerUsd).mockResolvedValueOnce(1550);
    expect((await getRate()).ngnPerUsd).toBe(1550);
  });
});

describe("CSRF guards", () => {
  const evil = { origin: "https://evil.example", "content-type": "application/json" };
  const post = (path: string, headers: Record<string, string>, body = "{}") => new Request(`http://localhost${path}`, { method: "POST", headers, body });
  test("JSON routes refuse a cross-site origin", async () => {
    expect((await withdraw(post("/api/withdrawals", evil))).status).toBe(403);
    expect((await wcode(post("/api/withdrawals/code", evil))).status).toBe(403);
    expect((await onboarding(post("/api/onboarding", evil))).status).toBe(403);
  });
  test("JSON routes refuse a non-JSON body", async () => {
    expect((await withdraw(post("/api/withdrawals", { "content-type": "text/plain" }))).status).toBe(415);
  });
  test("upload refuses a cross-site origin (multipart, no content-type rule)", async () => {
    const fd = new FormData(); fd.set("kind", "avatar");
    expect((await uploads(new Request("http://localhost/api/uploads", { method: "POST", headers: { origin: "https://evil.example" }, body: fd }))).status).toBe(403);
  });
});

describe("public report body cap", () => {
  const post = (body: string, headers: Record<string, string> = {}) =>
    reportRoute(new Request("http://localhost/api/reports", { method: "POST", headers: { "content-type": "application/json", ...headers }, body }));
  test("413 over 8 KB by content-length or by real size, before parsing", async () => {
    expect((await post("{}", { "content-length": "9000" })).status).toBe(413);
    expect((await post(JSON.stringify({ username: "a", reason: "spam", details: "x".repeat(9000) }))).status).toBe(413);
  });
});
