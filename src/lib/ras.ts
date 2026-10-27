/**
 * Roqqu API Service client for the business backend
 * (https://roqqu-api-services.gitbook.io/ras).
 *
 * Modes, from env:
 *   practice - no key: every call is simulated in RAS's response shape.
 *   test     - RAS_TEST_KEY, sent as x-staging-api-key (no real money).
 *   live     - RAS_LIVE_KEY, sent as x-api-key; refused unless
 *              ALLOW_PRODUCTION_EXECUTION=true.
 * POST bodies are form fields; objects travel as JSON strings.
 */
import { randomBytes } from "node:crypto";

export type RasMode = "practice" | "test" | "live";
export type Network = "bep20" | "trc20";
export type Coin = "usdt";

/** The two USDT networks a business wallet and a payment link use. */
export const NETWORKS: { network: Network; token: Coin; label: string }[] = [
  { network: "bep20", token: "usdt", label: "USDT on BNB Chain (BEP20)" },
  { network: "trc20", token: "usdt", label: "USDT on Tron (TRC20)" },
];

export const BASE_URL = process.env.ROQQU_BASE_URL || "https://service.roqqu.com/v1";

export class RasError extends Error {}
/** Missing key / live not allowed: thrown before any network call, so nothing was sent. */
export class RasConfigError extends RasError {}
/** RAS answered with JSON status "fail" (as opposed to config, network, auth or 5xx errors). */
export class RasFailure extends RasError {}

export function rasMode(): RasMode {
  const forced = (process.env.RAS_MODE ?? "").trim().toLowerCase();
  if (forced === "practice" || forced === "test" || forced === "live") return forced;
  if (process.env.RAS_TEST_KEY) return "test";
  if (process.env.RAS_LIVE_KEY) return "live";
  return "practice";
}

function keyHeaders(): Record<string, string> {
  const mode = rasMode();
  if (mode === "test") {
    if (!process.env.RAS_TEST_KEY) throw new RasConfigError("RAS_TEST_KEY is not set");
    return { "x-staging-api-key": process.env.RAS_TEST_KEY };
  }
  if (!process.env.RAS_LIVE_KEY) throw new RasConfigError("RAS_LIVE_KEY is not set");
  if (process.env.ALLOW_PRODUCTION_EXECUTION !== "true") {
    throw new RasConfigError("Live mode moves real crypto: set ALLOW_PRODUCTION_EXECUTION=true to allow it.");
  }
  return { "x-api-key": process.env.RAS_LIVE_KEY };
}

/** The key webhooks are encrypted with (null in practice mode). */
export function webhookKey(): string | null {
  const mode = rasMode();
  if (mode === "test") return process.env.RAS_TEST_KEY ?? null;
  if (mode === "live") return process.env.RAS_LIVE_KEY ?? null;
  return null;
}

export function form(body: Record<string, unknown>): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null || v === "") continue;
    out.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return out;
}

export async function rasCall<T>(method: "GET" | "POST" | "DELETE", path: string, body?: Record<string, unknown>, auth = true): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (auth) Object.assign(headers, keyHeaders());
  let payload: string | undefined;
  if (method !== "GET") {
    headers["content-type"] = "application/x-www-form-urlencoded";
    payload = form(body ?? {}).toString();
  }
  let res: Response;
  try {
    res = await fetch(BASE_URL + path, { method, headers, body: payload, cache: "no-store" });
  } catch (err) {
    throw new RasError(`Roqqu unreachable: ${err instanceof Error ? err.message : "network error"}`);
  }
  let json: { status?: string; message?: string; data?: T };
  try {
    json = await res.json();
  } catch {
    throw new RasError(`Roqqu HTTP ${res.status}: non-JSON response`);
  }
  if (json?.status === "fail" && res.status < 500 && res.status !== 401 && res.status !== 403) throw new RasFailure(json.message || `Roqqu HTTP ${res.status}`);
  if (!res.ok || json?.status !== "success") throw new RasError(json?.message || `Roqqu HTTP ${res.status}`);
  return json.data as T;
}

/* --- practice simulation ---------------------------------------------------- */

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function practiceAddress(network: Network): string {
  const bytes = randomBytes(40);
  if (network === "bep20") return "0x" + bytes.subarray(0, 20).toString("hex");
  return "T" + Array.from(bytes.subarray(0, 33), (b) => B58[b % 58]).join("");
}

/* --- endpoints ---------------------------------------------------------------- */

export interface Customer {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}

/** POST /transaction/network-fee: estimated fee for one send, in the token sent. */
export async function networkFee(network: Network): Promise<number> {
  if (rasMode() === "practice") return { bep20: 0.3, trc20: 1 }[network];
  const data = await rasCall<{ fee: number | string }>("POST", "/transaction/network-fee", { network });
  return Number(data?.fee ?? 0);
}

/** POST /wallets/send: queue a send from the merchant balance; returns the refid. */
export async function sendCoin(args: { token: Coin; network: Network; to: string; amount: string }): Promise<string> {
  if (rasMode() === "practice") return String(BigInt("0x" + randomBytes(8).toString("hex")));
  const data = await rasCall<{ refid: string | number }>("POST", "/wallets/send", args);
  if (data?.refid === undefined || data.refid === null || data.refid === "") throw new RasError("RAS send returned no refid");
  return String(data.refid);
}

export interface LinkWallet {
  network: Network;
  token: string;
  address: string;
}

export interface PaymentLink {
  refid: string;
  payment_link: string | null;
  wallets: LinkWallet[];
  expires_at: string;
}

/** POST /payment-links with pre-generated wallets for every network. */
export async function createPaymentLink(args: {
  amountNgn: string;
  reference: string;
  customer: Customer;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
}): Promise<PaymentLink> {
  const expires = new Date(Date.now() + 2 * 3600_000).toISOString();
  if (rasMode() === "practice") {
    return {
      refid: "practice" + randomBytes(6).toString("hex"),
      payment_link: null,
      wallets: NETWORKS.map((n) => ({ network: n.network, token: n.token.toUpperCase(), address: practiceAddress(n.network) })),
      expires_at: expires,
    };
  }
  const data = await rasCall<{
    refid: string;
    payment_link: string;
    wallets?: { address: string; network: string; token: string }[];
    expires_at?: string;
  }>("POST", "/payment-links", {
    amount: args.amountNgn,
    amount_currency: "ngn",
    customer_details: args.customer,
    payment_reference: args.reference,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    metadata: args.metadata,
    wallets: NETWORKS.map((n) => ({ network: n.network, token: n.token.toUpperCase() })),
  });
  return {
    refid: String(data.refid),
    payment_link: data.payment_link ?? null,
    wallets: (data.wallets ?? []).map((w) => ({ network: w.network as Network, token: w.token, address: w.address })),
    expires_at: data.expires_at ?? expires,
  };
}

/** POST /transaction/requery/<network>: has this on-chain tx confirmed? A "fail" status is not an error. */
export async function requeryTx(network: Network, txHash: string): Promise<{ confirmed: boolean; message: string }> {
  if (rasMode() === "practice") return { confirmed: true, message: "practice" };
  try {
    await rasCall<unknown>("POST", `/transaction/requery/${network}`, { tx_hash: txHash });
    return { confirmed: true, message: "success" };
  } catch (err) {
    if (err instanceof RasFailure) return { confirmed: false, message: err.message };
    throw err;
  }
}

/** GET /transaction/refId/<refid>: state of a queued send. */
export async function sendStatus(refid: string): Promise<"queued" | "completed" | "failed"> {
  if (rasMode() === "practice") return "completed";
  const rec = await rasCall<{ status?: string } | null>("GET", `/transaction/refId/${encodeURIComponent(refid)}`);
  const st = String(rec?.status ?? "").toLowerCase();
  if (/\b(fail(ed|ure)?|reject(ed)?|cancel(l?ed)?|unsuccessful)\b/.test(st)) return "failed";
  if (/\b(success(ful)?|complete(d)?)\b/.test(st)) return "completed";
  return "queued";
}

/* --- public market data (no key), cached a minute ----------------------------- */

const cache = new Map<string, { at: number; data: unknown }>();

async function publicGet<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < 60_000) return hit.data as T | null;
  let data: T | null = null;
  try {
    data = await rasCall<T>("GET", path, undefined, false);
  } catch {
    data = null; // cached as a miss too, so a down API is not hammered
  }
  cache.set(path, { at: Date.now(), data });
  return data;
}

/** Live NGN per USD from GET /rates; throws RasError when Roqqu gives no rate. */
export async function ngnPerUsd(): Promise<number> {
  const rows = await publicGet<{ symbol: string; rate: number }[]>("/rates");
  const ngn = rows?.find((r) => r.symbol?.toLowerCase() === "ngn")?.rate;
  if (!(Number(ngn) > 0)) {
    if (rasMode() === "practice") return 1500; // offline practice runs still need a rate
    throw new RasError("no NGN rate from Roqqu");
  }
  return Number(ngn);
}

/** For tests: forget cached market data. */
export function clearRasCache() {
  cache.clear();
}
