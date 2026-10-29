import { afterEach, expect, test, vi } from "vitest";

import { walletPay, withBuffer } from "@/lib/walletPay";

const ADDR = "0x" + "ab".repeat(20);
afterEach(() => vi.unstubAllEnvs());

test("buffer adds 1% and rounds up to the cent", () => {
  expect(withBuffer("1.00")).toBe("1.01");
  expect(withBuffer("0.80")).toBe("0.81"); // 0.808 rounds up
  expect(withBuffer("4.00")).toBe("4.04");
  expect(withBuffer("12.5")).toBe("12.63"); // 12.625 rounds up
});

test("live pays real BEP20 USDT on BNB Smart Chain", () => {
  vi.stubEnv("RAS_MODE", "live");
  expect(walletPay(ADDR, "1.00")).toMatchObject({ chainId: 56, token: "0x55d398326f99059fF775485246999027B3197955", amountUsdt: "1.01", simulate: false });
});

test("test mode needs a test token, practice simulates", () => {
  vi.stubEnv("RAS_MODE", "test");
  expect(walletPay(ADDR, "1.00")).toBeNull();
  vi.stubEnv("WALLET_TEST_USDT", ADDR);
  expect(walletPay(ADDR, "1.00")).toMatchObject({ chainId: 97, token: ADDR, simulate: false });
  vi.stubEnv("RAS_MODE", "practice");
  expect(walletPay(ADDR, "1.00")).toMatchObject({ simulate: true });
});

test("no EVM address, no wallet option", () => {
  vi.stubEnv("RAS_MODE", "live");
  expect(walletPay(undefined, "1.00")).toBeNull();
  expect(walletPay("TQ9xabc", "1.00")).toBeNull();
});
