// All decimal math in BigInt micro-units (1 USDT = 1_000_000). No floats.
const MICRO = 1_000_000n;

export function toMicro(s: string): bigint {
  const m = /^(\d+)(?:\.(\d{0,6})\d*)?$/.exec(s.trim());
  if (!m) throw new Error(`bad amount: ${s}`);
  return BigInt(m[1]) * MICRO + BigInt((m[2] ?? "").padEnd(6, "0"));
}

export function fromMicro(n: bigint, dp = 6): string {
  const whole = n / MICRO;
  const frac = (n % MICRO).toString().padStart(6, "0").slice(0, dp);
  return dp ? `${whole}.${frac}` : `${whole}`;
}

/** NGN (whole naira) to USDT, rounded up to cents, fixed 2dp. */
export function ngnToUsdt(ngn: number, ngnPerUsd: number): string {
  const rate = BigInt(Math.round(ngnPerUsd * 10_000)); // rate at 4dp
  if (rate <= 0n || !Number.isFinite(ngn) || ngn < 0) throw new Error("bad ngn/rate");
  const num = BigInt(Math.round(ngn)) * 1_000_000n; // ngn * 10_000 * 100 cents
  const cents = (num + rate - 1n) / rate;
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

/** Platform fee on amount, rounded down to 6dp. */
export function feeUsdt(amount: string, bps = Number(process.env.PLATFORM_FEE_BPS ?? 500)): string {
  return fromMicro((toMicro(amount) * BigInt(bps)) / 10_000n);
}

/** Split total by integer weights; remainder goes to index 0; parts sum exactly. */
export function splitAmount(total: string, shares: number[]): string[] {
  const t = toMicro(total);
  const w = shares.map((s) => BigInt(s));
  const sum = w.reduce((a, b) => a + b, 0n);
  if (sum <= 0n) throw new Error("bad shares");
  const parts = w.map((x) => (t * x) / sum);
  parts[0] += t - parts.reduce((a, b) => a + b, 0n);
  return parts.map((p) => fromMicro(p));
}
