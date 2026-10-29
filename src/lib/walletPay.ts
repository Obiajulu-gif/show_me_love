import { rasMode } from "./ras";

/** What the browser needs to pay a link's BEP20 address straight from a wallet. */
export type WalletPay = {
  address: string; amountUsdt: string; chainId: number; chainName: string;
  token: string; decimals: number; simulate: boolean;
};

const BSC_USDT = "0x55d398326f99059fF775485246999027B3197955";
const isEvm = (a: string | undefined) => !!a && /^0x[0-9a-fA-F]{40}$/.test(a);

/** Roqqu only quotes the naira total, so the wallet sends our USDT quote plus 1%, rounded up to the cent. Extra is credited as overpaid. */
export function withBuffer(usdt: string): string {
  const [w, f = ""] = usdt.split(".");
  const cents = BigInt(w) * 100n + BigInt((f + "00").slice(0, 2));
  const out = (cents * 101n + 99n) / 100n;
  return `${out / 100n}.${(out % 100n).toString().padStart(2, "0")}`;
}

/** Null when this link has no EVM address or the mode has no chain to pay on (test without WALLET_TEST_USDT). */
export function walletPay(address: string | undefined, usdt: string): WalletPay | null {
  if (!isEvm(address)) return null;
  const base = { address: address!, amountUsdt: withBuffer(usdt) };
  const mode = rasMode();
  if (mode === "live") return { ...base, chainId: 56, chainName: "BNB Smart Chain", token: BSC_USDT, decimals: 18, simulate: false };
  // practice: nothing goes on chain; the button simulates the payment instead
  if (mode === "practice") return { ...base, chainId: 97, chainName: "BNB Smart Chain Testnet", token: BSC_USDT, decimals: 18, simulate: true };
  const token = process.env.WALLET_TEST_USDT;
  if (!isEvm(token)) return null;
  return { ...base, chainId: 97, chainName: "BNB Smart Chain Testnet", token: token!, decimals: Number(process.env.WALLET_TEST_USDT_DECIMALS || 18), simulate: false };
}
