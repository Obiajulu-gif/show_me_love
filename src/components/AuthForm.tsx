"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { safeNext } from "@/lib/safeNext";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";
  const qs = new URLSearchParams();
  for (const k of ["treat", "username", "next"]) if (params.get(k)) qs.set(k, params.get(k)!);
  const q = qs.toString() ? `?${qs}` : "";

  async function post(path: string, body: object) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    return { res, data };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { res, data } = await post(`/api/auth/${mode}`, { email, password });
    if (!res.ok) return setMsg(data.error ?? "Something went wrong.");
    router.push(signup ? `/onboarding${q}` : safeNext(params.get("next")) ?? "/dashboard");
    router.refresh();
  }

  async function magic() {
    const { res, data } = await post("/api/auth/magic", { email, next: params.get("next") });
    if (!res.ok) return setMsg(data.error ?? "Something went wrong.");
    setMsg(data.devLink ? `Dev link: ${data.devLink}` : "If that email has an account, a sign-in link is on its way.");
  }

  const input = "w-full rounded-xl border border-line bg-white px-3 py-2 text-cocoa outline-none focus:border-cocoa-2";
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-4 text-cocoa">
      <div className="w-full max-w-sm rounded-[18px] border border-line bg-cream-2 p-6">
        <h1 className="font-serif text-3xl italic">{signup ? "Create your page" : "Welcome back"}</h1>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={input} type="password" required placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <button disabled={busy} className="w-full rounded-xl bg-honey px-4 py-2 font-semibold text-honey-ink shadow-[0_4px_0_#3B2416] disabled:opacity-60">
            {signup ? "Sign up" : "Log in"}
          </button>
        </form>
        <button type="button" disabled={busy || !email} onClick={magic} className="mt-3 w-full rounded-xl border border-line px-4 py-2 text-sm hover:bg-cream disabled:opacity-60">
          Email me a sign-in link
        </button>
        {msg && <p className="mt-3 break-all text-sm text-cocoa-2">{msg}</p>}
        <p className="mt-5 text-sm text-cocoa-2">
          {signup ? (
            <>Already have an account? <Link className="underline" href={`/login${q}`}>Log in</Link></>
          ) : (
            <>New here? <Link className="underline" href={`/signup${q}`}>Create a page</Link></>
          )}
        </p>
      </div>
    </main>
  );
}
