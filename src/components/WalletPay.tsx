"use client";
import { walletConnect } from "@wagmi/connectors";
import {
  connect, createConfig, getBalance, http, injected, readContract, switchChain, waitForTransactionReceipt, writeContract,
  type Connector,
} from "@wagmi/core";
import { ExternalLink, Loader2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { erc20Abi, parseUnits } from "viem";
import { bsc, bscTestnet } from "viem/chains";

import type { WalletPay as Pay } from "@/lib/walletPay";

import { buttonClass } from "./ui/Button";

const WC_ID = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

function makeConfig() {
  return createConfig({
    chains: [bsc, bscTestnet],
    connectors: [
      injected(),
      ...(WC_ID ? [walletConnect({ projectId: WC_ID, showQrModal: true, metadata: { name: "show-me-love", description: "Send a treat", url: window.location.origin, icons: [`${window.location.origin}/icon.svg`] } })] : []),
    ],
    transports: { [bsc.id]: http(), [bscTestnet.id]: http() },
  });
}

type Step = "pick" | "connecting" | "sending" | "confirming";
const LABEL: Record<Step, string> = { pick: "", connecting: "Approve the connection in your wallet", sending: "Confirm the transfer in your wallet", confirming: "Waiting for the network to confirm" };

/** Pays a Roqqu link's BEP20 address from the supporter's own wallet. Roqqu's webhook credits the creator as usual. */
export function WalletPay({ pay, thanksUrl, roqquUrl, payRef }: { pay: Pay; thanksUrl: string; roqquUrl: string; payRef: string }) {
  const config = useMemo(() => (typeof window === "undefined" ? null : makeConfig()), []);
  const [connectors, setConnectors] = useState<readonly Connector[]>([]);
  const [step, setStep] = useState<Step>("pick");
  const [err, setErr] = useState<string | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const chainId = pay.chainId as 56 | 97;
  const explorer = chainId === 56 ? "https://bscscan.com/tx/" : "https://testnet.bscscan.com/tx/";

  // EIP-6963 wallets (MetaMask, Coinbase, Trust, Rabby…) announce themselves after mount.
  useEffect(() => {
    if (!config) return;
    const pick = () => {
      const all = config.connectors;
      const named = all.filter((c) => c.id !== "injected");
      setConnectors(named.some((c) => c.type === "injected") ? named : all);
    };
    pick();
    return config.subscribe((s) => s.connections, pick);
  }, [config]);

  async function simulate() {
    setStep("confirming"); setErr(null);
    const r = await fetch("/api/dev/simulate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ref: payRef }) }).catch(() => null);
    if (!r?.ok) { setStep("pick"); return setErr("Couldn't simulate the payment."); }
    window.location.assign(thanksUrl);
  }

  async function payWith(c: Connector) {
    if (!config) return;
    setErr(null);
    try {
      setStep("connecting");
      const { accounts } = await connect(config, { connector: c, chainId }).catch(async (e) => {
        if (String(e?.name).includes("AlreadyConnected")) return { accounts: (await c.getAccounts()) as readonly `0x${string}`[] };
        throw e;
      });
      const account = accounts[0];
      if ((await c.getChainId()) !== chainId) await switchChain(config, { chainId, connector: c });

      const amount = parseUnits(pay.amountUsdt, pay.decimals);
      const token = pay.token as `0x${string}`;
      const [usdt, gas] = await Promise.all([
        readContract(config, { address: token, abi: erc20Abi, functionName: "balanceOf", args: [account], chainId }),
        getBalance(config, { address: account, chainId }),
      ]);
      if (usdt < amount) { setStep("pick"); return setErr(`This wallet has less than ${pay.amountUsdt} USDT on ${pay.chainName}. Top it up or use another wallet.`); }
      if (gas.value === 0n) { setStep("pick"); return setErr(`This wallet has no BNB to pay the network fee. Add a little BNB on ${pay.chainName} and try again.`); }

      setStep("sending");
      const tx = await writeContract(config, { address: token, abi: erc20Abi, functionName: "transfer", args: [pay.address as `0x${string}`, amount], chainId, connector: c, account });
      setHash(tx);
      setStep("confirming");
      await waitForTransactionReceipt(config, { hash: tx, chainId });
      window.location.assign(thanksUrl);
    } catch (e) {
      setStep("pick");
      const m = e instanceof Error ? e.message : String(e);
      setErr(/reject|denied|cancel/i.test(m) ? "You cancelled in your wallet. Nothing was sent." : "The wallet couldn't complete the payment. Try again, or use Roqqu checkout.");
    }
  }

  const busy = step !== "pick";
  return (
    <div className="space-y-4 motion-safe:animate-dialog-in">
      <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
        <p className="text-sm text-muted">You send</p>
        <p className="data mt-0.5 text-2xl font-medium text-accent">{pay.amountUsdt} USDT</p>
        <p className="mt-1 text-xs text-muted">BEP20 on {pay.chainName}. Includes 1% so a rate move can&apos;t leave it short; any extra goes to the creator.</p>
      </div>

      {pay.simulate ? (
        <button type="button" disabled={busy} onClick={simulate} className={buttonClass("primary", "w-full")}>
          {busy ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> : <Wallet size={16} aria-hidden />}Simulate wallet payment
        </button>
      ) : connectors.length ? (
        <ul className="space-y-2" aria-label="Choose a wallet">
          {connectors.map((c) => (
            <li key={c.uid}>
              <button type="button" disabled={busy} onClick={() => payWith(c)} className={buttonClass("ghost", "w-full justify-start")}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {c.icon ? <img src={c.icon} alt="" className="h-5 w-5 rounded" /> : <Wallet size={18} aria-hidden />}
                {c.id === "injected" ? "Browser wallet" : c.name}
              </button>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">No wallet found in this browser. Install MetaMask, or use Roqqu checkout below.</p>}

      {busy && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 size={14} className="motion-safe:animate-spin" aria-hidden />{LABEL[step] || "Working"}</p>}
      {hash && <a href={explorer + hash} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-muted underline"><span className="data truncate">{hash}</span><ExternalLink size={12} aria-hidden /></a>}
      {err && <p role="alert" className="text-sm text-danger">{err}</p>}

      <a href={roqquUrl} className="block text-center text-sm text-muted underline hover:text-fg">Pay on Roqqu checkout instead (copy address or QR, BEP20 or TRC20)</a>
    </div>
  );
}
