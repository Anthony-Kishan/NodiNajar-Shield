"use client";
import { useEffect, useState } from "react";
import { Footer } from "@/components/Shell";

interface Status {
  state: "open" | "off" | "not-yet" | "closed";
  admin: boolean;
  now: string;
  access: { enabled: boolean; start: string; end: string; durationDays: number | null; adminConfigured: boolean };
  fromEnv: Record<string, boolean>;
}

const STATE: Record<Status["state"], { label: string; cls: string; text: string }> = {
  open: { label: "PUBLIC", cls: "ok", text: "Anyone can open /docs right now." },
  off: { label: "OFF", cls: "erosion", text: "/docs is switched off. Visitors get a 403 page; signed-in admins can still preview." },
  "not-yet": { label: "SCHEDULED", cls: "watch", text: "/docs opens at the start of the window. Visitors get a 403 page until then." },
  closed: { label: "CLOSED", cls: "erosion", text: "The viewing window has ended. Visitors get a 403 page." },
};

/** Convert an ISO time to the value a datetime-local input expects, in Dhaka time. */
function toLocal(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  return new Date(t + 6 * 3600000).toISOString().slice(0, 16);
}
const fromLocal = (v: string) => (v ? `${v}:00+06:00` : "");
const show = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) + " (Dhaka)" : iso;
};

export default function DocsAdmin() {
  const [s, setS] = useState<Status | null>(null);
  const [token, setToken] = useState("");
  const [err, setErr] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [mode, setMode] = useState<"dates" | "duration">("dates");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState("5");
  const [copied, setCopied] = useState(false);

  const load = () => fetch("/api/docs-admin", { cache: "no-store" }).then((r) => r.json()).then((x: Status) => {
    setS(x);
    setEnabled(x.access.enabled);
    setStart(toLocal(x.access.start));
    setEnd(toLocal(x.access.end));
    if (x.access.durationDays) { setMode("duration"); setDays(String(x.access.durationDays)); }
  }).catch(() => setErr("Could not reach /api/docs-admin."));
  useEffect(() => { load(); }, []);

  const signIn = async () => {
    setErr("");
    const r = await fetch("/api/docs-admin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErr((j as { error?: string }).error ?? "Sign-in failed."); return; }
    setToken("");
    load();
  };
  const signOut = async () => { await fetch("/api/docs-admin", { method: "DELETE" }); load(); };

  const env = [
    `DOCS_ENABLED=${enabled ? "true" : "false"}`,
    `DOCS_START=${fromLocal(start)}`,
    ...(mode === "duration" ? [`DOCS_DURATION_DAYS=${days}`] : [`DOCS_END=${fromLocal(end)}`]),
  ].join("\n");
  const copy = async () => { try { await navigator.clipboard.writeText(env); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy these lines", env); } };

  return (
    <>
      <main className="page docs-page">
        <div className="page-head">
          <div>
            <h2>Docs admin</h2>
            <p>Control who can open <a href="/docs/">/docs</a> and when. The switch and the viewing window are checked on every request, so the page opens and closes on time by itself.</p>
          </div>
          {s && <span className={`docs-status big ${STATE[s.state].cls}`}>{STATE[s.state].label}</span>}
        </div>

        {err && <div className="docs-preview">{err}</div>}

        {s && (
          <div className="docs-grid2">
            <section className="docs-card">
              <h3>Current status</h3>
              <p>{STATE[s.state].text}</p>
              <table className="data docs-table">
                <tbody>
                  <tr><td>Switch</td><td><b>{s.access.enabled ? "ON" : "OFF"}</b> {!s.fromEnv.DOCS_ENABLED && <span className="dim">(default)</span>}</td></tr>
                  <tr><td>Opens</td><td><b>{show(s.access.start)}</b> {!s.fromEnv.DOCS_START && <span className="dim">(default)</span>}</td></tr>
                  <tr><td>Closes</td><td><b>{show(s.access.end)}</b> {s.access.durationDays ? <span className="dim">({s.access.durationDays} days after opening)</span> : !s.fromEnv.DOCS_END && <span className="dim">(default)</span>}</td></tr>
                  <tr><td>Server time</td><td>{show(s.now)}</td></tr>
                  <tr><td>You</td><td>{s.admin ? <b>Signed in as admin</b> : "Visitor"}</td></tr>
                </tbody>
              </table>
              <div className="docs-actions">
                <a className="docs-btn primary" href="/docs/">{s.admin && s.state !== "open" ? "Preview /docs" : "Open /docs"}</a>
                {s.admin && <button className="docs-btn" onClick={signOut}>Sign out</button>}
              </div>
            </section>

            <section className="docs-card">
              {!s.access.adminConfigured ? (
                <>
                  <h3>Set up admin sign-in</h3>
                  <p>Add a long random secret as <code>DOCS_ADMIN_TOKEN</code> in Vercel (Project → Settings → Environment Variables), then redeploy. Admins sign in here with it.</p>
                </>
              ) : !s.admin ? (
                <>
                  <h3>Admin sign-in</h3>
                  <p className="dim">Admins and super admins share the admin token. Signing in lets you preview /docs while it is off and prepare schedule changes.</p>
                  <form onSubmit={(e) => { e.preventDefault(); signIn(); }} className="docs-form">
                    <input type="password" autoComplete="current-password" placeholder="Admin token" value={token} onChange={(e) => setToken(e.target.value)} />
                    <button className="docs-btn primary" type="submit" disabled={!token}>Sign in</button>
                  </form>
                </>
              ) : (
                <>
                  <h3>Change visibility and schedule</h3>
                  <div className="docs-form col">
                    <label className="docs-toggle"><input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Docs switched {enabled ? "ON" : "OFF"}</label>
                    <label>Opens (Dhaka time)<input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} /></label>
                    <div className="docs-seg">
                      <button className={mode === "dates" ? "on" : ""} onClick={() => setMode("dates")} type="button">End date</button>
                      <button className={mode === "duration" ? "on" : ""} onClick={() => setMode("duration")} type="button">Duration</button>
                    </div>
                    {mode === "dates"
                      ? <label>Closes (Dhaka time)<input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
                      : <label>Open for (days)<input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} /></label>}
                    <pre className="docs-env">{env}</pre>
                    <button className="docs-btn primary" type="button" onClick={copy}>{copied ? "Copied" : "Copy settings"}</button>
                    <p className="dim">Paste these into Vercel → Settings → Environment Variables and press Redeploy (about a minute). Turning the page off takes effect on that deploy; opening and closing times then apply by themselves.</p>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
