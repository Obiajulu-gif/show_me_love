"use client";
import { useState } from "react";

import { AI_PROMPT, CALLBACK_SNIPPET, CONNECT_SNIPPET, ENV_BLOCK, HELPER_SNIPPET, SHOW_SNIPPET, SMOKE_STEPS } from "@/lib/docsContent";

import { Tabs } from "./ui/Tabs";

const TABS = [{ id: "manual", label: "Manual" }, { id: "ai", label: "AI assistant" }] as const;

function Block({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="relative my-3">
      <button type="button" aria-label={label}
        className="absolute right-2 top-2 rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs font-semibold hover:bg-surface"
        onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* the text is selectable on screen */ } }}>
        {done ? "Copied" : "Copy"}
      </button>
      <pre className="overflow-x-auto rounded-xl border border-line bg-surface-2 p-3 pt-9 text-xs leading-relaxed"><code>{text}</code></pre>
    </div>
  );
}

export function IntegrationGuide() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("manual");
  return (
    <div className="text-sm">
      <Tabs tabs={TABS} value={tab} onChange={setTab} label="Integration style" />
      {tab === "manual" ? (
        <div className="mt-4">
          <p>No package to install: use <code>fetch</code> on your server. Full details are in the <a href="/docs" className="underline">docs</a>.</p>
          <h3 className="mt-4 font-bold">1. Environment</h3>
          <Block text={ENV_BLOCK} label="Copy environment block" />
          <h3 className="mt-4 font-bold">2. Helper</h3>
          <Block text={HELPER_SNIPPET} label="Copy helper" />
          <h3 className="mt-4 font-bold">3. Connect and callback routes</h3>
          <Block text={CONNECT_SNIPPET} label="Copy connect route" />
          <Block text={CALLBACK_SNIPPET} label="Copy callback route" />
          <h3 className="mt-4 font-bold">4. Show the support link</h3>
          <Block text={SHOW_SNIPPET} label="Copy support link snippet" />
          <h3 className="mt-4 font-bold">5. Smoke test</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5">{SMOKE_STEPS.map((s) => <li key={s}>{s}</li>)}</ol>
        </div>
      ) : (
        <div className="mt-4">
          <p>Paste this into your AI coding assistant, then add your env values yourself. Never paste your API key into a chat.</p>
          <Block text={AI_PROMPT} label="Copy prompt" />
        </div>
      )}
    </div>
  );
}
