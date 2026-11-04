"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";

type Usdt = { network: "bep20" | "trc20"; address: string } | null;
type Bank = { bankName: string; accountNumber: string; accountName: string } | null;
type Quote = { feeUsdt: string; receives: string; receivesNgn?: number };
const input = "w-full rounded-xl border border-line bg-surface-2 px-3 py-2";
const short = (u: NonNullable<Usdt>) => `${u.network.toUpperCase()} ${u.address.slice(0, 6)}…${u.address.slice(-4)}`;
const masked = (b: NonNullable<Bank>) => `${b.bankName} ••${b.accountNumber.slice(-4)}`;

async function call(url: string, method: string, body?: unknown) {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? "Something went wrong.");
  return j;
}

export function WithdrawPanel({ available, usdt, bank }: { available: string; usdt: Usdt; bank: Bank }) {
  const router = useRouter();
  const [modal, setModal] = useState<"dest" | "withdraw" | null>(null);
  const [tab, setTab] = useState<"usdt" | "bank">(usdt || !bank ? "usdt" : "bank");
  const [net, setNet] = useState<"bep20" | "trc20">(usdt?.network ?? "bep20");
  const [addr, setAddr] = useState(usdt?.address ?? "");
  const [b, setB] = useState({ bankName: bank?.bankName ?? "", accountNumber: bank?.accountNumber ?? "", accountName: bank?.accountName ?? "" });
  const [method, setMethod] = useState<"usdt" | "ngn_bank">(usdt || !bank ? "usdt" : "ngn_bank");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (f: () => Promise<void>) => {
    setBusy(true); setMsg("");
    try { await f(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  };
  const close = () => { setModal(null); setMsg(""); setSent(false); setCode(""); setQuote(null); };
  const getQuote = async (): Promise<Quote> => (await call(`/api/withdrawals?method=${method}&amount=${encodeURIComponent(amount)}`, "GET")).quote;
  const dest = method === "usdt" ? usdt : bank;
  const destLine = method === "usdt" ? (usdt ? short(usdt) : "") : bank ? masked(bank) : "";

  return (
    <>
      {notice && <p role="status" className="mb-3 rounded-xl border border-line bg-surface-2 p-3 text-sm">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between text-sm text-muted">Available
            <button aria-label="Refresh balance" onClick={() => router.refresh()}><RefreshCw size={16} /></button>
          </div>
          <div className="data mt-1 text-3xl font-medium text-green">{Number(available).toFixed(2)} <span className="text-base font-medium">USDT</span></div>
          <Button className="mt-4" onClick={() => setModal("withdraw")}>Make a withdrawal</Button>
        </Card>
        <Card>
          <div className="text-sm text-muted">Where it goes</div>
          <div className="mt-1 space-y-1">
            <div className="data">{usdt ? short(usdt) : "No USDT wallet yet"}</div>
            <div>{bank ? masked(bank) : "No bank account yet"}</div>
          </div>
          <Button variant="ghost" className="mt-4" onClick={() => setModal("dest")}>Change</Button>
        </Card>
      </div>

      {modal && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-fg/25 backdrop-blur-sm p-4 motion-safe:animate-scrim-in" onClick={close}>
          <div className="w-full max-w-md space-y-4 rounded-[18px] border border-line bg-surface p-6 shadow-paper-lift motion-safe:animate-dialog-in" onClick={(e) => e.stopPropagation()}>
            {modal === "dest" ? (
              <>
                <h2 className="text-xl font-semibold">Payout destination</h2>
                <Tabs label="Destination type" value={tab} onChange={setTab} tabs={[{ id: "usdt", label: "USDT wallet" }, { id: "bank", label: "Bank (NGN)" }]} />
                {tab === "usdt" ? (
                  <>
                    <select aria-label="Network" className={input} value={net} onChange={(e) => setNet(e.target.value as "bep20" | "trc20")}>
                      <option value="bep20">BEP20 (BNB Chain)</option><option value="trc20">TRC20 (Tron)</option>
                    </select>
                    <input aria-label="Wallet address" className={input} placeholder="Wallet address" value={addr} onChange={(e) => setAddr(e.target.value)} />
                  </>
                ) : (
                  <>
                    <input aria-label="Bank name" className={input} placeholder="Bank name" value={b.bankName} onChange={(e) => setB({ ...b, bankName: e.target.value })} />
                    <input aria-label="Account number" className={input} inputMode="numeric" maxLength={10} placeholder="10-digit account number" value={b.accountNumber} onChange={(e) => setB({ ...b, accountNumber: e.target.value.replace(/\D/g, "") })} />
                    <input aria-label="Account name" className={input} placeholder="Account name" value={b.accountName} onChange={(e) => setB({ ...b, accountName: e.target.value })} />
                  </>
                )}
                {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => run(async () => {
                    await call("/api/withdrawals/destination", "PUT", tab === "usdt" ? { kind: "usdt", network: net, address: addr } : { kind: "bank", ...b });
                    close(); router.refresh();
                  })}>Save</Button>
                  <Button variant="ghost" onClick={close}>Cancel</Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-semibold">Withdraw</h2>
                <label className="block text-sm">Withdraw from
                  <select className={`${input} mt-1`} value={method} onChange={(e) => { setMethod(e.target.value as "usdt" | "ngn_bank"); setQuote(null); }}>
                    <option value="usdt">USDT wallet</option><option value="ngn_bank">NGN bank</option>
                  </select>
                </label>
                <div className="flex justify-between text-sm"><span>Available</span><b className="data">{Number(available).toFixed(2)} USDT</b></div>
                <label className="block text-sm">Amount (USDT)
                  <div className="mt-1 flex gap-2">
                    <input className={input} inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setQuote(null); }}
                      onBlur={() => { if (amount && dest) getQuote().then(setQuote, (e: Error) => setMsg(e.message)); }} />
                    <Button variant="ghost" type="button" onClick={() => { setAmount(available); setQuote(null); }}>Use full balance</Button>
                  </div>
                </label>
                <p className="text-sm">{dest ? `To ${destLine}` : "Add a payout destination first."}</p>
                {quote && (
                  <div className="rounded-xl border border-line bg-surface-2 p-3 text-sm">
                    <div className="flex justify-between"><span>Fee</span><span className="data">{quote.feeUsdt} USDT</span></div>
                    <div className="flex justify-between font-semibold"><span>Your destination receives</span>
                      <span>{method === "ngn_bank" && quote.receivesNgn !== undefined ? `₦${quote.receivesNgn.toLocaleString("en-NG")}` : `${quote.receives} USDT`}</span></div>
                  </div>
                )}
                {sent && <input aria-label="6-digit code" className={input} inputMode="numeric" maxLength={6} placeholder="6-digit code from your email" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />}
                {msg && <p role="alert" className="text-sm text-danger">{msg}</p>}
                <div className="flex gap-2">
                  {!sent ? (
                    <Button disabled={busy || !dest || !amount} onClick={() => run(async () => {
                      setQuote(await getQuote());
                      const r = await call("/api/withdrawals/code", "POST", { method });
                      if (r.devCode) setCode(r.devCode);
                      setSent(true);
                    })}>Send code</Button>
                  ) : (
                    <Button disabled={busy || code.length !== 6} onClick={() => run(async () => {
                      const j = await call("/api/withdrawals", "POST", { method, amount, code });
                      const w = j.withdrawal ?? {};
                      setNotice(w.status === "failed" ? "Payout failed: nothing was sent and the money is back in your balance."
                        : w.stuck ? "Sent, but the outcome is unclear. Admins have been told and will check it."
                        : "");
                      close(); router.refresh();
                    })}>Withdraw</Button>
                  )}
                  <Button variant="ghost" onClick={close}>Cancel</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
