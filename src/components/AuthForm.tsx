"use client";
import { Check, Eye, EyeOff, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { safeNext } from "@/lib/safeNext";

import { LiveLedger } from "./LiveLedger";
import { Logo } from "./Logo";
import { buttonClass } from "./ui/Button";

const MIN = 8;
const JOURNEY = [
  { title: "Create your account", body: "An email and a password." },
  { title: "Pick your treat", body: "Zobo, suya, jollof or your own." },
  { title: "Claim your link", body: "show-me-love/@you" },
  { title: "Share it", body: "Treats arrive in USDT." },
];

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(
    params.get("error") === "link" ? { text: "That sign-in link has expired or was already used. Enter your email and send a new one.", error: true } : null,
  );
  const [busy, setBusy] = useState<"form" | "magic" | null>(null);
  const signup = mode === "signup";
  const claiming = params.get("username");
  const qs = new URLSearchParams();
  for (const k of ["treat", "username", "next"]) if (params.get(k)) qs.set(k, params.get(k)!);
  const q = qs.toString() ? `?${qs}` : "";
  const longEnough = password.length >= MIN;

  async function post(path: string, body: object, kind: "form" | "magic") {
    setBusy(kind);
    setMsg(null);
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await res?.json().catch(() => ({}));
    setBusy(null);
    return { ok: !!res?.ok, data: data ?? {} };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { ok, data } = await post(`/api/auth/${mode}`, { email, password }, "form");
    if (!ok) return setMsg({ text: data.error ?? "Couldn't reach the server. Check your connection and try again.", error: true });
    router.push(signup ? `/onboarding${q}` : safeNext(params.get("next")) ?? "/dashboard");
    router.refresh();
  }

  async function magic() {
    const { ok, data } = await post("/api/auth/magic", { email, next: params.get("next") }, "magic");
    if (!ok) return setMsg({ text: data.error ?? "Couldn't send the link. Try again.", error: true });
    setMsg({ text: data.devLink ? `Dev link: ${data.devLink}` : `If ${email} has an account, a sign-in link is on its way. It works once, for 15 minutes.`, error: false });
  }

  const input = "w-full rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-fg placeholder:text-muted/70 transition-colors duration-150 focus:border-accent focus:outline-none";

  return (
    <main className="grid min-h-screen bg-canvas text-fg lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <section className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="font-display text-4xl font-semibold tracking-tight">{signup ? "Create your account" : "Log in"}</h1>
          <p className="mt-2 text-muted">
            {signup ? "Free to start. Your page is live in about a minute." : "Pick up where you left off: your page, your treats, your balance."}
          </p>
          {signup && claiming && (
            <p className="mt-4 inline-flex w-fit items-center gap-2 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-sm">
              <Check size={14} className="text-accent" aria-hidden />Saving <span className="data">@{claiming}</span> for you
            </p>
          )}

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate={false}>
            <div>
              <label htmlFor="auth-email" className="text-sm font-semibold">Email</label>
              <input id="auth-email" className={`${input} mt-1.5`} type="email" required autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <label htmlFor="auth-password" className="text-sm font-semibold">Password</label>
                {!signup && <button type="button" onClick={magic} disabled={!!busy || !email} className="text-sm text-muted underline hover:text-fg disabled:no-underline disabled:opacity-60">Forgot it?</button>}
              </div>
              <div className="relative mt-1.5">
                <input id="auth-password" className={`${input} pr-11`} type={show ? "text" : "password"} required minLength={signup ? MIN : undefined} autoComplete={signup ? "new-password" : "current-password"}
                  aria-describedby={signup ? "pw-hint" : undefined} value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-muted hover:text-fg">
                  {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
              {signup && (
                <p id="pw-hint" className={`mt-1.5 flex items-center gap-1.5 text-sm transition-colors duration-150 ${longEnough ? "text-accent" : "text-muted"}`}>
                  <Check size={14} aria-hidden className={longEnough ? "opacity-100" : "opacity-40"} />At least {MIN} characters
                </p>
              )}
            </div>
            <button disabled={!!busy} className={buttonClass("primary", "w-full py-2.5 text-base")}>
              {busy === "form" && <Loader2 size={18} className="motion-safe:animate-spin" aria-hidden />}
              {signup ? "Create account" : "Log in"}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3 text-sm text-muted" aria-hidden><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
          <button type="button" disabled={!!busy || !email} onClick={magic} className={buttonClass("ghost", "w-full")}>
            {busy === "magic" ? <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden /> : <Mail size={16} aria-hidden />}
            Email me a sign-in link
          </button>
          {!email && <p className="mt-1.5 text-center text-xs text-muted">Enter your email above first.</p>}

          {msg && <p role={msg.error ? "alert" : "status"} className={`mt-4 break-words rounded-xl border px-3 py-2 text-sm ${msg.error ? "border-danger/40 bg-danger/10 text-danger" : "border-line bg-surface text-fg"}`}>{msg.text}</p>}

          <p className="mt-8 text-sm text-muted">
            {signup
              ? <>Already have an account? <Link className="font-semibold text-fg underline" href={`/login${q}`}>Log in</Link></>
              : <>New to show-me-love? <Link className="font-semibold text-fg underline" href={`/signup${q}`}>Create an account</Link></>}
          </p>
          {signup && <p className="mt-3 text-xs text-muted">By creating an account you agree to the <Link href="/legal#terms" className="underline">terms</Link> and <Link href="/legal#privacy" className="underline">privacy notice</Link>.</p>}
        </div>
      </section>

      <aside className="relative hidden overflow-hidden border-l border-line bg-surface/50 lg:flex lg:flex-col lg:justify-center lg:px-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-love/15 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-32 left-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        {signup ? (
          <div className="relative max-w-md">
            <h2 className="font-display text-3xl font-semibold tracking-tight">Four steps to your first treat</h2>
            <ol className="mt-8">
              {JOURNEY.map((s, i) => (
                <li key={s.title} className="relative flex gap-4 pb-7 last:pb-0">
                  {i < JOURNEY.length - 1 && <span className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-line" aria-hidden />}
                  <span className={`data flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm ${i === 0 ? "border-accent bg-accent text-on-accent" : "border-line bg-canvas text-muted"}`}>{i + 1}</span>
                  <div className="pt-1">
                    <p className={`font-semibold ${i === 0 ? "text-fg" : "text-fg/80"}`}>{s.title}{i === 0 && <span className="ml-2 text-sm font-normal text-accent">You are here</span>}</p>
                    <p className={`mt-0.5 text-sm text-muted ${i === 2 ? "data" : ""}`}>{i === 2 && claiming ? `show-me-love/@${claiming}` : s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="relative w-full max-w-lg">
            <h2 className="mb-6 font-display text-3xl font-semibold tracking-tight">Treats keep settling while you&apos;re away</h2>
            <LiveLedger />
          </div>
        )}
      </aside>
    </main>
  );
}
