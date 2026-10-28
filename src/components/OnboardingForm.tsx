"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Logo } from "./Logo";
import { TreatPicker, type TreatChoice } from "./TreatPicker";
import { UsernameField } from "./UsernameField";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

export function OnboardingForm({ treat: t0, username: u0 }: { treat: string; username: string }) {
  const router = useRouter();
  const [treat, setTreat] = useState<TreatChoice>({ treatId: t0, customTreat: t0 === "custom" ? { name: "", emoji: "" } : undefined });
  const [username, setUsername] = useState(u0);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/onboarding", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, ...treat }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setBusy(false); return setErr(d.error ?? "Something went wrong."); }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center gap-6 bg-canvas px-4 py-10 text-fg">
      <Logo />
      <Card className="w-full max-w-md">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Almost there</h1>
        <p className="mt-1 text-sm text-muted">Confirm your treat and your link. You can change both later.</p>
        <h2 className="mt-5 font-semibold">Your treat</h2>
        <div className="mt-2"><TreatPicker value={treat} onChange={setTreat} /></div>
        <h2 className="mt-5 font-semibold">Your username</h2>
        <div className="mt-2"><UsernameField value={username} onChange={setUsername} onStatus={setOk} /></div>
        {err && <p role="alert" className="mb-2 text-sm text-danger">{err}</p>}
        <Button disabled={busy || !ok} onClick={submit} className="mt-2 w-full">Create my page</Button>
      </Card>
    </main>
  );
}
