import { ngnPerUsd } from "./ras";

export class RateUnavailable extends Error {}

const FRESH_MS = 60_000;
const STALE_MS = 10 * 60_000;
let cached: { value: number; at: number } | null = null;

/** NGN per USD: cached 60 s; on RAS failure reuse a rate under 10 min old; else throw. */
export async function getRate(): Promise<{ ngnPerUsd: number; at: Date }> {
  const now = Date.now();
  if (cached && now - cached.at < FRESH_MS) return { ngnPerUsd: cached.value, at: new Date(cached.at) };
  try {
    const value = await ngnPerUsd();
    if (!Number.isFinite(value) || value <= 0) throw new Error("bad rate");
    cached = { value, at: now };
  } catch {
    if (!cached || now - cached.at >= STALE_MS) throw new RateUnavailable("no recent NGN rate");
  }
  return { ngnPerUsd: cached.value, at: new Date(cached.at) };
}

/** For tests only. */
export function resetRateCache() {
  cached = null;
}
