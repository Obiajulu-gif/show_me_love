import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { CALLBACK_SNIPPET, CONNECT_SNIPPET, ENV_BLOCK, HELPER_SNIPPET, SHOW_SNIPPET } from "@/lib/docsContent";

export const metadata: Metadata = { title: "Developer docs · show-me-love" };

const Code = ({ children }: { children: string }) => (
  <pre tabIndex={0} role="region" aria-label="Code sample" className="my-3 overflow-x-auto rounded-xl border border-line bg-surface-2 p-3.5 font-mono text-[12.5px] leading-relaxed text-fg focus-visible:ring-2 focus-visible:ring-accent"><code>{children}</code></pre>
);
const H2 = ({ id, children }: { id: string; children: ReactNode }) => (
  <h2 id={id} className="mt-12 scroll-mt-6 font-display text-2xl font-extrabold tracking-[-0.035em] sm:text-3xl">{children}</h2>
);

type Err = [number, string, string];
type Endpoint = { id: string; method: "GET" | "POST"; path: string; what: string; body?: string; ok: string; errors: Err[] };

const AUTH_ERR: Err = [401, "Invalid client credentials.", "Missing or wrong key, unknown client id, revoked key, or a key from the other mode."];
const RATE_ERR: Err = [429, "Too many requests.", "More than 120 calls a minute for this app."];
const JSON_ERR: Err[] = [
  [415, "Send JSON.", "The Content-Type is not application/json."],
  [400, "Send a JSON object.", "The body is not a JSON object."],
];

const ENDPOINTS: Endpoint[] = [
  {
    id: "sessions", method: "POST", path: "/api/connect/sessions",
    what: "Starts a connection. Returns a one-time link to send the user's browser to.",
    body: `{ "user_ref": "u_123", "redirect_uri": "https://app.example.com/api/sml/callback", "state": "random-string" }`,
    ok: `200 { "authorize_url": "https://…/connect/authorize?req=…" }  (valid for 10 minutes)`,
    errors: [AUTH_ERR, ...JSON_ERR,
      [400, "Send user_ref, redirect_uri and an optional state as strings.", "A field is missing or not a string."],
      [400, "user_ref must be 1 to 128 characters.", ""],
      [400, "state can be at most 256 characters.", ""],
      [400, "That redirect_uri isn't registered for this app.", "It must match one of your redirect links exactly."],
      RATE_ERR],
  },
  {
    id: "token", method: "POST", path: "/api/connect/token",
    what: "Swaps the code from your callback for a connection. Call it once per code.",
    body: `{ "code": "…" }`,
    ok: `200 { "connected": true }`,
    errors: [AUTH_ERR, ...JSON_ERR,
      [400, "Send the code as a string.", ""],
      [400, "Code is invalid or expired.", "Codes last 10 minutes, work once, and only for the app that asked."],
      RATE_ERR],
  },
  {
    id: "connection", method: "GET", path: "/api/connect/connection?user_ref=u_123",
    what: "Returns the creator linked to this user, if the link is still active.",
    ok: `200 { "username": "ada", "display_name": "Ada", "support_url": "https://…/@ada", "earnings_shared": false }`,
    errors: [AUTH_ERR, [400, "Send user_ref.", "Missing, or longer than 128 characters."], [404, "Not connected.", "Never connected, disconnected, or revoked by the creator."], RATE_ERR],
  },
  {
    id: "earnings", method: "GET", path: "/api/connect/earnings?user_ref=u_123",
    what: "Returns total support received, only when the creator ticked the share-earnings option while allowing.",
    ok: `200 { "total_received": "12.50", "currency": "USDT", "treats": 5 }  (sandbox apps always get these sample numbers)`,
    errors: [AUTH_ERR, [400, "Send user_ref.", ""], [403, "Earnings not shared.", "The creator did not share earnings with your app."], [404, "Not connected.", ""], RATE_ERR],
  },
  {
    id: "disconnect", method: "POST", path: "/api/connect/disconnect",
    what: "Ends the link from your side and cancels any code not yet exchanged. Safe to repeat.",
    body: `{ "user_ref": "u_123" }`,
    ok: `200 { "ok": true }`,
    errors: [AUTH_ERR, ...JSON_ERR, [400, "Send user_ref.", "Missing, empty, or longer than 128 characters."], RATE_ERR],
  },
];

const TOC = [["overview", "Overview"], ["quickstart", "Quickstart"], ["api", "HTTP API"], ["security", "Security checklist"], ["live", "Going live"]];

const CURL = `curl -X POST "$SML_ORIGIN/api/connect/sessions" \\
  -H "Authorization: Bearer $SML_API_KEY" -H "X-Client-Id: $SML_CLIENT_ID" \\
  -H "Content-Type: application/json" \\
  -d "{\\"user_ref\\":\\"u_123\\",\\"redirect_uri\\":\\"$SML_REDIRECT_URI\\"}"`;

export default function Docs() {
  return (
    <div className="theme-paper min-h-screen bg-canvas text-fg">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 text-[15px] leading-relaxed sm:py-14">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-accent">Developers · Connect API</p>
        <h1 className="mt-2 font-display text-[clamp(2.4rem,5vw,3.6rem)] font-extrabold leading-[0.98] tracking-[-0.045em]">Connect: developer docs</h1>
        <p className="mt-4 max-w-[58ch] text-muted">Link your app to a creator&apos;s show-me-love page, then read their support link and totals with their permission. Plain HTTP, no SDK.</p>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2 text-[12.5px] font-semibold">
          {TOC.map(([id, t]) => <a key={id} href={`#${id}`} className="rounded-full border border-line bg-surface px-3 py-1.5 text-muted transition-colors hover:border-accent/50 hover:text-fg">{t}</a>)}
        </nav>

        <H2 id="overview">Overview</H2>
        <p className="mt-3">
          Connect lets your app link one of its users to their show-me-love page. After the user presses Allow, your server can look up their
          support link (and, if they choose, their totals) with a few plain HTTP calls. There is no SDK to install: everything below uses <code>fetch</code>.
        </p>
        <p className="mt-3">
          The flow: your server asks for a session, the user approves on show-me-love, we send them back to your callback with a short-lived code,
          and your server swaps that code for a connection. Each of your users is identified by a <code>user_ref</code>, an id you pick from your own system (1 to 128 characters).
        </p>

        <H2 id="quickstart">Quickstart</H2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>In <Link href="/dashboard/developers" className="underline">Developers</Link>, create a <strong>Sandbox</strong> app and register your callback link, for example <code>http://localhost:3001/api/sml/callback</code>.</li>
          <li>Create an API key. It is shown once, so copy it straight into your server env.</li>
          <li>Set the environment on your server:<Code>{ENV_BLOCK}</Code></li>
          <li>Add a small helper and a connect route. Both run on your server.<Code>{HELPER_SNIPPET}</Code><Code>{CONNECT_SNIPPET}</Code></li>
          <li>Add the callback, then show the support link:<Code>{CALLBACK_SNIPPET}</Code><Code>{SHOW_SNIPPET}</Code></li>
        </ol>
        <p className="mt-3">A complete working app lives in <code>examples/connect-starter</code> in the repository.</p>

        <H2 id="api">HTTP API</H2>
        <p className="mt-3">
          Base URL: your show-me-love origin. Every call needs <code>Authorization: Bearer &lt;key&gt;</code> and <code>X-Client-Id: &lt;client id&gt;</code>.
          POST bodies must be JSON with <code>Content-Type: application/json</code>. Failures return <code>{`{ "error": "…" }`}</code> with the status shown below.
          Each app can make 120 calls a minute.
        </p>
        <Code>{CURL}</Code>
        {ENDPOINTS.map((e) => (
          <section key={e.id} id={e.id} className="mt-8 scroll-mt-6 rounded-[18px] border border-line bg-surface p-4 shadow-paper">
            <h3 className="text-lg font-bold"><span className="mr-2 rounded bg-accent px-2 py-0.5 text-sm text-on-accent">{e.method}</span><code className="break-all text-base">{e.path}</code></h3>
            <p className="mt-2">{e.what}</p>
            {e.body && <><p className="mt-3 text-sm font-semibold">Body</p><Code>{e.body}</Code></>}
            <p className="mt-3 text-sm font-semibold">Success</p>
            <Code>{e.ok}</Code>
            <p className="text-sm font-semibold">Errors</p>
            <table className="mt-1 w-full text-left text-sm">
              <tbody>
                {e.errors.map(([s, m, why], i) => (
                  <tr key={i} className="border-t border-line align-top">
                    <td className="py-1 pr-3 font-mono">{s}</td>
                    <td className="py-1 pr-3"><code>{m}</code></td>
                    <td className="py-1 text-muted">{why}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
        <p className="mt-6 text-sm text-muted">
          The callback: on Allow, the user returns to your redirect link with <code>?code=…&amp;state=…</code>. On Deny they return with <code>?error=access_denied&amp;state=…</code>.
          If you sent no <code>state</code>, none comes back.
        </p>

        <H2 id="security">Security checklist</H2>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li><strong>Keys stay on your server.</strong> Never put <code>SML_API_KEY</code> in browser code, a mobile app, or a public repo. If one leaks, revoke it in Developers and make a new one.</li>
          <li><strong>Take <code>user_ref</code> from your own session.</strong> Never read it from a form field, query string or request body the browser controls, or anyone could link themselves to someone else&apos;s account.</li>
          <li><strong>Use a random <code>state</code></strong>: set it in an httpOnly cookie when you start, and compare it on the callback before exchanging the code.</li>
          <li><strong>Register exact redirect links.</strong> Matching is character for character: no wildcards, no trailing-slash tolerance. Use https (http only for localhost). No <code>#</code> fragments.</li>
          <li><strong>Test the unhappy paths:</strong> press Deny and make sure your app copes with <code>access_denied</code>; revoke the app from the Share page and make sure <code>/connection</code> then returns 404 and your UI says not connected.</li>
          <li><strong>Use the sandbox first.</strong> Sandbox keys (<code>sml_test_…</code>) only work with sandbox apps, and sandbox earnings are sample numbers.</li>
        </ul>

        <H2 id="live">Going live</H2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          <li>Create a separate <strong>Live</strong> app in Developers, with your production redirect links (https only).</li>
          <li>Create a live key (<code>sml_live_…</code>) and put it, with the live client id, in your production env. Keep the sandbox values for development.</li>
          <li>Update <code>SML_ORIGIN</code>, <code>APP_ORIGIN</code> and <code>SML_REDIRECT_URI</code> to the production addresses.</li>
          <li>Run the full flow once with a real creator account: Connect, Allow, support link shows, revoke, not connected.</li>
          <li>Live <code>/earnings</code> returns the creator&apos;s real totals, so only ask for it if you need it.</li>
        </ol>
      </main>
    </div>
  );
}
