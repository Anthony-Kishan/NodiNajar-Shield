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

const EXAMPLES: { q: string; icon: string }[] = [
  { q: "Which stretches need geobags first if we have 3 crews and 300 shelter places?", icon: "🛟" },
  { q: "Why is C011 high risk, and how many people live in its forecast zone?", icon: "📍" },
  { q: "Is the Jamuna rising this week?", icon: "🌊" },
  { q: "C019-এর জন্য সতর্কবার্তা দাও", icon: "📣" },
  { q: "How good is the forecast model, and what are its limits?", icon: "🧪" },
  { q: "Did the system warn before the Jotpara erosion reported in July?", icon: "📰" },
];
const TOOL_NAMES: Record<string, string> = {
  season_summary: "Season totals", list_stretches: "Ranked stretches", get_stretch: "Stretch details", river_outlook: "River forecast",
  model_report: "Model test", plan_response: "Response planner", alert_for: "Official alert", search_knowledge: "Methods & news",
};

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
    setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
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
      setTimeout(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    }
  }

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">AI assistant · Bangla or English</div>
            <h2>Ask NodiNajar</h2>
            <p>Answers come only from NodiNajar&apos;s own data. Every number is checked against what the tools returned, and alerts are always the official template.</p>
          </div>
        </div>
        <div className="grid g-3">
          <div className="card chat span-2">
            <div className="chat-log">
              {turns.length === 0 && (
                <div style={{ margin: "auto", textAlign: "center", maxWidth: 420, padding: "30px 0" }}>
                  <div style={{ fontSize: 44 }}>🌊</div>
                  <h3 style={{ fontSize: 24, margin: "6px 0" }}>What do you want to know about the river?</h3>
                  <p className="muted">Try a question on the right, or ask about any stretch ID like C011.</p>
                </div>
              )}
              {turns.map((t, i) => (
                <div key={i} style={{ display: "contents" }}>
                  <div className={`msg ${t.role === "user" ? "user" : "bot"}${t.error ? " err" : ""}`}>{t.content}</div>
                  {t.role === "assistant" && !t.error && (
                    <div className="msg-meta">
                      {t.tools?.map((x, k) => <span key={k} className="pill blue">⚙ {TOOL_NAMES[x.name] ?? x.name}</span>)}
                      {t.grounding && (t.grounding.grounded
                        ? <span className="pill green">✓ numbers verified</span>
                        : <span className="pill amber">⚠ check {t.grounding.ungrounded.join(", ")}</span>)}
                      {t.sources?.map((s, k) => s.url
                        ? <a key={k} className="pill grey" href={s.url} target="_blank" rel="noreferrer">↗ {s.source.replace("ground_truth/events.csv#", "news ")}</a>
                        : <span key={k} className="pill grey">{s.source}</span>)}
                    </div>
                  )}
                </div>
              ))}
              {busy && <div className="msg bot" style={{ padding: 0 }}><span className="typing"><i /><i /><i /></span></div>}
              <div ref={end} />
            </div>
            <form className="chat-input" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about a stretch, the river, the plan…" aria-label="Question" />
              <button className="btn primary" type="submit" disabled={busy || !q.trim()}>Ask ↑</button>
            </form>
          </div>
          <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
            <div className="card">
              <h3>Try asking</h3>
              <div className="suggest" style={{ marginTop: 10 }}>
                {EXAMPLES.map((e) => <button key={e.q} type="button" onClick={() => ask(e.q)} disabled={busy}><span style={{ marginRight: 8 }}>{e.icon}</span>{e.q}</button>)}
              </div>
            </div>
            <div className="card tint-river">
              <h3>Use it in your own AI app</h3>
              <p className="muted" style={{ fontSize: 13.5 }}>The same 9 tools run as an MCP server for Claude Desktop or any MCP client.</p>
              <pre style={{ fontSize: 11.5, whiteSpace: "pre-wrap", background: "#fff", padding: 12, borderRadius: 12, border: "1px solid var(--line)", margin: 0 }}>{`"nodinajar": {
  "command": "python",
  "args": ["-m", "mcp_server.server"],
  "cwd": "/path/to/NodiNajar-Shield"
}`}</pre>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
