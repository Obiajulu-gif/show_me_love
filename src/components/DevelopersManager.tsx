"use client";
import { BookOpen, Check, Code2, Copy, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { IntegrationGuide } from "./IntegrationGuide";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Tabs } from "./ui/Tabs";

type Mode = "sandbox" | "live";
export type AppRow = {
  id: string; name: string; mode: Mode; redirectUris: string[]; clientId: string;
  keys: { id: string; prefix: string; last4: string; createdAt: string }[];
};

const MODES = [{ id: "live", label: "Live" }, { id: "sandbox", label: "Sandbox" }] as const;
const date = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

async function call(url: string, method: string, body: unknown): Promise<{ ok: boolean; data: Record<string, string> }> {
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server. Try again." } };
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={label} className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-semibold hover:bg-surface"
      onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the text is selectable on screen */ } }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : "Copy"}
    </button>
  );
}

function Overlay({ title, onClose, side, sticky, children }: { title: string; onClose: () => void; side?: boolean; sticky?: boolean; children: ReactNode }) {
  return (
    <div className={`fixed inset-0 z-50 flex bg-canvas/75 backdrop-blur-sm ${side ? "justify-end" : "items-center justify-center p-4"}`} onClick={sticky ? undefined : onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`bg-canvas p-6 shadow-xl ${side ? "h-full w-full max-w-md overflow-y-auto" : "w-full max-w-lg rounded-[18px] border border-line"}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AppForm({ app, defaultMode, onCreated, onClose }: { app?: AppRow; defaultMode: Mode; onCreated: (m: Mode) => void; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(app?.name ?? "");
  const [mode, setMode] = useState<Mode>(app?.mode ?? defaultMode);
  const [uris, setUris] = useState(app?.redirectUris.join("\n") ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setErr("");
    const redirectUris = uris.split("\n").map((s) => s.trim()).filter(Boolean);
    const r = app ? await call(`/api/developers/apps/${app.id}`, "PATCH", { name, redirectUris }) : await call("/api/developers/apps", "POST", { name, mode, redirectUris });
    setBusy(false);
    if (!r.ok) return setErr(r.data.error ?? "Couldn't save the app.");
    if (!app) onCreated(mode);
    router.refresh(); onClose();
  }
  const field = "mt-1 w-full rounded-xl border border-line bg-surface-2 px-3 py-2";
  return (
    <Overlay title={app ? "Edit app" : "Create an app"} onClose={onClose}>
      <div className="space-y-4">
        <label className="block text-sm font-semibold">App name
          <input className={field} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </label>
        {!app && (
          <div>
            <p className="text-sm font-semibold">Mode</p>
            <div className="mt-1"><Tabs label="App mode" tabs={[{ id: "sandbox", label: "Sandbox" }, { id: "live", label: "Live" }] as const} value={mode} onChange={setMode} /></div>
            <p className="mt-1 text-xs text-muted">Sandbox keys are for testing. The mode can&apos;t change later.</p>
          </div>
        )}
        <label className="block text-sm font-semibold">Redirect links, one per line (up to 5)
          <textarea className={`${field} font-mono text-sm`} rows={4} value={uris} onChange={(e) => setUris(e.target.value)} placeholder="https://yourapp.com/sml/callback" />
        </label>
        <p className="text-xs text-muted">Must start with https://. http:// works only for localhost. People are sent back to these exact links, so add each one in full.</p>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <Button onClick={save} disabled={busy}>{app ? "Save changes" : "Create app"}</Button>
      </div>
    </Overlay>
  );
}

function StarterConfig({ app, origin }: { app: AppRow; origin: string }) {
  const first = app.redirectUris[0] ?? "";
  let appOrigin = "";
  try { appOrigin = new URL(first).origin; } catch { /* no redirect yet */ }
  const text = [
    `SML_ORIGIN=${origin || "<this site's address>"}`,
    `SML_CLIENT_ID=${app.clientId}`,
    "SML_API_KEY=<your key>",
    `APP_ORIGIN=${appOrigin}`,
    `SML_REDIRECT_URI=${first}`,
  ].join("\n");
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">Starter configuration</p>
        <CopyButton text={text} label="Copy starter configuration" />
      </div>
      <pre className="overflow-x-auto text-xs">{text}</pre>
    </div>
  );
}

export function DevelopersManager({ apps, origin, guide }: { apps: AppRow[]; origin: string; guide: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("live");
  const [form, setForm] = useState<"new" | AppRow | null>(null);
  const [issued, setIssued] = useState<{ key: string; app: string } | null>(null);
  const [err, setErr] = useState("");
  const shown = apps.filter((a) => a.mode === mode);

  async function generate(a: AppRow) {
    setErr("");
    const r = await call(`/api/developers/apps/${a.id}/keys`, "POST", {});
    if (!r.ok) return setErr(r.data.error ?? "Couldn't make a key.");
    setIssued({ key: r.data.key, app: a.name });
    router.refresh();
  }
  async function revoke(a: AppRow, keyId: string) {
    if (!window.confirm("Revoke this key? Anything using it stops working right away.")) return;
    setErr("");
    const r = await call(`/api/developers/apps/${a.id}/keys`, "DELETE", { keyId });
    if (!r.ok) setErr(r.data.error ?? "Couldn't revoke the key.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Developers</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Tabs label="Mode" tabs={MODES} value={mode} onChange={setMode} />
          <Button variant="ghost" onClick={() => router.push("?guide=open")}><BookOpen size={16} /> Integration guide</Button>
          {apps.length > 0 && <Button onClick={() => setForm("new")}><Plus size={16} /> Create an app</Button>}
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
      {apps.length === 0 ? (
        <Card className="text-center">
          <Code2 className="mx-auto text-muted" size={32} />
          <p className="mt-2 font-semibold">Let other apps send people to your page</p>
          <p className="mt-1 text-sm text-muted">Register an app, get a client id and API keys, and let your own product link to show-me-love.</p>
          <Button className="mt-4" onClick={() => setForm("new")}>Create an app</Button>
        </Card>
      ) : shown.length === 0 ? (
        <Card className="text-center text-sm text-muted">No {mode} apps yet.</Card>
      ) : (
        <ul className="space-y-4">
          {shown.map((a) => (
            <li key={a.id}>
              <Card className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{a.name}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                      Client id <code className="rounded bg-surface-2 px-1.5 py-0.5 text-fg">{a.clientId}</code>
                      <CopyButton text={a.clientId} label={`Copy client id for ${a.name}`} />
                    </p>
                  </div>
                  <Button variant="ghost" onClick={() => setForm(a)}>Edit</Button>
                </div>
                <div>
                  <p className="text-sm font-semibold">Redirect links</p>
                  <ul className="mt-1 space-y-1 text-sm">{a.redirectUris.map((u) => <li key={u} className="break-all font-mono">{u}</li>)}</ul>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">API keys</p>
                    <Button variant="ghost" onClick={() => generate(a)}>Generate key</Button>
                  </div>
                  {a.keys.length === 0 ? <p className="mt-1 text-sm text-muted">No active keys.</p> : (
                    <ul className="mt-2 space-y-2">
                      {a.keys.map((k) => (
                        <li key={k.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm">
                          <span><code>{k.prefix}…{k.last4}</code> <span className="text-muted">created {date(k.createdAt)}</span></span>
                          <button type="button" className="font-semibold text-red-700 hover:underline" onClick={() => revoke(a, k.id)}>Revoke</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <StarterConfig app={a} origin={origin} />
              </Card>
            </li>
          ))}
        </ul>
      )}
      {form && <AppForm app={form === "new" ? undefined : form} defaultMode={mode} onCreated={setMode} onClose={() => setForm(null)} />}
      {issued && (
        <Overlay title="Your new API key" sticky onClose={() => setIssued(null)}>
          <p className="text-sm">For <strong>{issued.app}</strong>. Copy it now. It won&apos;t be shown again.</p>
          <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 text-sm" data-testid="issued-key">{issued.key}</pre>
          <div className="mt-4 flex gap-3">
            <CopyButton text={issued.key} label="Copy API key" />
            <Button onClick={() => setIssued(null)}>I&apos;ve copied it</Button>
          </div>
        </Overlay>
      )}
      {guide && (
        <Overlay title="Integration guide" side onClose={() => router.push("/dashboard/developers")}>
          <IntegrationGuide />
        </Overlay>
      )}
    </div>
  );
}
