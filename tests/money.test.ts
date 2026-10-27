import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../src/lib/ras", () => ({ ngnPerUsd: vi.fn() }));
import { ngnPerUsd } from "../src/lib/ras";
import { ngnToUsdt, feeUsdt, splitAmount } from "../src/lib/money";
import { getRate, RateUnavailable, resetRateCache } from "../src/lib/rates";

describe("money", () => {
  it("ngnToUsdt rounds up to cents", () => {
    expect(ngnToUsdt(500, 1500)).toBe("0.34");
    expect(ngnToUsdt(1500, 1500)).toBe("1.00");
    expect(ngnToUsdt(1000, 1532.75)).toBe("0.66");
  });
  it("feeUsdt rounds down to 6dp", () => {
    expect(feeUsdt("10.000000", 500)).toBe("0.500000");
    expect(feeUsdt("0.333333", 500)).toBe("0.016666");
  });
  it("splitAmount gives remainder to index 0", () => {
    const parts = splitAmount("10", [1, 1, 1]);
    expect(parts).toEqual(["3.333334", "3.333333", "3.333333"]);
    expect(parts.reduce((a, p) => a + Math.round(Number(p) * 1e6), 0)).toBe(10_000_000);
  });
});

describe("getRate", () => {
  const mock = vi.mocked(ngnPerUsd);
  beforeEach(() => {
    vi.useFakeTimers();
    mock.mockReset();
    resetRateCache();
  });
  afterEach(() => vi.useRealTimers());

  it("caches for 60s, falls back to stale under 10min, then throws", async () => {
    mock.mockResolvedValueOnce(1500);
    expect((await getRate()).ngnPerUsd).toBe(1500);
    await getRate();
    expect(mock).toHaveBeenCalledTimes(1);
    mock.mockRejectedValue(new Error("down"));
    vi.advanceTimersByTime(5 * 60_000);
    expect((await getRate()).ngnPerUsd).toBe(1500);
    vi.advanceTimersByTime(6 * 60_000);
    await expect(getRate()).rejects.toBeInstanceOf(RateUnavailable);
  });
  it("throws when never fetched and RAS fails", async () => {
    mock.mockRejectedValue(new Error("down"));
    await expect(getRate()).rejects.toBeInstanceOf(RateUnavailable);
  });
});
