"use client";
import { useRef, useState } from "react";
import { Footer } from "@/components/Shell";

interface Turn {
  role: "user" | "assistant";
  content: string;
  tools?: { name: string; input: Record<string, unknown> }[];
  grounding?: { grounded: boolean; ungrounded: number[] };
  sources?: { source: string; url?: string }[];
  error?: boolean;
}

const EXAMPLES = [
  "Which stretches need geobags first if we have 3 crews and 300 shelter places?",
  "Why is C011 high risk, and how many people live in its forecast zone?",
  "Is the Jamuna rising this week?",
  "C019-এর জন্য সতর্কবার্তা দাও",
  "How good is the forecast model, and what are its limits?",
  "Did the system warn before the Jotpara erosion reported in July?",
];

export default function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  async function ask(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setQ("");
    setBusy(true);
    try {
      const r = await fetch("/api/assistant", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.filter((t) => !t.error).map((t) => ({ role: t.role, content: t.content })) }),
      });
      const j = await r.json();
      if (!r.ok) setTurns([...next, { role: "assistant", content: j.error ?? `Error ${r.status}`, error: true }]);
      else setTurns([...next, { role: "assistant", content: j.answer, tools: j.tools, grounding: j.grounding, sources: j.sources }]);
    } catch {
      setTurns([...next, { role: "assistant", content: "The assistant could not be reached. The rest of the app works without it.", error: true }]);
    } finally {
      setBusy(false);
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <h2>Ask NodiNajar</h2>
            <p>An AI assistant for upazila officers, NGOs and journalists, in Bangla or English. It answers only from NodiNajar&apos;s own data through 8 read-only tools, checks every number in its answer against what the tools returned, and never writes alerts: those are fixed templates.</p>
          </div>
        </div>
        <div className="grid g-3">
          <div className="card span-2" style={{ display: "flex", flexDirection: "column", minHeight: "60dvh" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
              {turns.length === 0 && <p className="muted">Ask a question, or pick one of the examples.</p>}
              {turns.map((t, i) => (
                <div key={i} style={{ alignSelf: t.role === "user" ? "flex-end" : "stretch", maxWidth: t.role === "user" ? "80%" : "100%" }}>
                  <div className="card" style={{ padding: "10px 14px", background: t.role === "user" ? "var(--panel-2)" : undefined, borderColor: t.error ? "var(--erosion)" : undefined }}>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{t.content}</div>
                  </div>
                  {t.tools && t.tools.length > 0 && (
                    <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>Tools: {t.tools.map((x) => x.name + (Object.keys(x.input).length ? `(${Object.values(x.input).join(", ")})` : "")).join(" → ")}</div>
                  )}
                  {t.grounding && (t.grounding.grounded
                    ? <div style={{ fontSize: 12, marginTop: 4, color: "var(--ok)" }}>✓ Every number above appears in the tool results.</div>
                    : <p className="note warn" style={{ fontSize: 12 }}>Check these numbers: {t.grounding.ungrounded.join(", ")} did not appear in the data the assistant read.</p>)}
                  {t.sources && t.sources.length > 0 && (
                    <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>Sources: {t.sources.map((s, k) => s.url ? <a key={k} href={s.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{s.source}</a> : <span key={k} style={{ marginRight: 8 }}>{s.source}</span>)}</div>
                  )}
                </div>
              ))}
              {busy && <p className="muted">Reading the data…</p>}
              <div ref={end} />
            </div>
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a stretch, the river, the plan…" aria-label="Question"
                style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--deep)", color: "var(--text)", font: "inherit" }} />
              <button className="btn primary" type="submit" disabled={busy || !q.trim()}>Ask</button>
            </form>
          </div>
          <div className="card" style={{ alignSelf: "start" }}>
            <h3>Try</h3>
            <ul className="list" style={{ marginTop: 8 }}>
              {EXAMPLES.map((e) => <li key={e}><button type="button" className="row-link" onClick={() => ask(e)} disabled={busy}><span className="row-main">{e}</span></button></li>)}
            </ul>
            <div className="ctrl-title" style={{ marginTop: 16 }}>Use it from your own AI client</div>
            <p className="muted" style={{ fontSize: 13 }}>The same tools are an MCP server. In Claude Desktop or any MCP client:</p>
            <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", background: "var(--deep)", padding: 10, borderRadius: 8 }}>{`"nodinajar": {
  "command": "python",
  "args": ["-m", "mcp_server.server"],
  "cwd": "/path/to/NodiNajar-Shield"
}`}</pre>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
