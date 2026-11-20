"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Footer } from "@/components/Shell";
import { dataUrl } from "@/lib/data";
import { useJson } from "@/lib/extra";
import {
  APIS_EXPOSED, APIS_USED, FEATURES, ORIGINAL_REPO, PERFORMANCE, PITCH, PRODUCT, REPO, ROADMAP, SECURITY, STACK, TEAM,
  type Member, type Status,
} from "@/content/docs";

/* ---------- live data shapes (only the fields this page reads) ---------- */
interface ModelScore { n: number; positives: number; brier: number; precision: number; recall: number; auc: number }
interface Hazard { model: string; n_rows: number; base_rate: number; status: string; features: { name: string; label: string }[]; backtest: { tested_passes: number[]; best: string; models: Record<string, ModelScore> } }
interface Exposure { household_size: number; household_source: string; totals: { homes: number; people_est: number; homes_in_high_zone: number; people_in_high_zone_est: number } }
interface Scorecard { status: string; summary: { counts: Record<string, number>; on_bank: number; hit_rate: number; median_lead_days: number } }
interface Manifest { generated_utc: string; passes: { date: string }[]; totals: { land_lost_ha: number; max_retreat_m: number; cells_red: number; cells_amber: number; homes_near_new_bank: number } }
interface Outlook { fetched_utc: string; status: string; river: { trend: string; band: string; gauge: string } }
interface Priorities { generated: string; default_plan: { crews: number; shelter: number; actions: { id: string; action: string; expected_people: number; places?: number }[] } }
interface Commit { sha: string; date: string; message: string; url: string }

const nf = (x: number, d = 0) => x.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: d });
const day = (iso?: string) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" }) + " BDT" : "–");

const NAV: { id: string; label: string; group: string }[] = [
  { id: "pitch", label: "Pitch deck", group: "Pitch" },
  { id: "team", label: "Team", group: "Pitch" },
  { id: "overview", label: "Product overview", group: "Product" },
  { id: "features", label: "Feature matrix", group: "Product" },
  { id: "architecture", label: "Architecture", group: "Engineering" },
  { id: "dataflow", label: "Data flow", group: "Engineering" },
  { id: "stack", label: "Technology stack", group: "Engineering" },
  { id: "api", label: "APIs", group: "Engineering" },
  { id: "data", label: "Data layer", group: "Engineering" },
  { id: "ai", label: "AI layer", group: "Engineering" },
  { id: "roadmap", label: "Roadmap", group: "Plan" },
  { id: "performance", label: "Performance & scale", group: "Plan" },
  { id: "security", label: "Security", group: "Plan" },
  { id: "analytics", label: "Analytics & KPIs", group: "Plan" },
  { id: "changelog", label: "Changelog", group: "Plan" },
];

const STATUS: Record<Status, { label: string; cls: string }> = {
  live: { label: "Live", cls: "ok" }, beta: { label: "Beta", cls: "watch" }, next: { label: "Next", cls: "river" }, planned: { label: "Planned", cls: "dim" },
};

function Section({ id, n, title, lead, children }: { id: string; n: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="docs-sec" data-doc-section>
      <div className="docs-sec-head">
        <span className="docs-n">{n}</span>
        <div>
          <h2><a href={`#${id}`} className="docs-anchor">{title}</a></h2>
          {lead && <p className="docs-lead">{lead}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Avatar({ m }: { m: Member }) {
  const [broken, setBroken] = useState(false);
  const initials = m.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  if (m.photo && !broken) return <img className="docs-avatar" src={m.photo} alt={m.name} width={112} height={112} loading="lazy" onError={() => setBroken(true)} />;
  return <div className="docs-avatar docs-avatar-fallback" aria-label={m.name}>{initials}</div>;
}

function LiveTag({ when }: { when?: string }) {
  return <span className="docs-live" title="Read from the app's data files when this page loaded"><span className="pulse-dot" />live{when ? ` · ${when}` : ""}</span>;
}

/* ---------- diagrams (inline SVG, no extra libraries) ---------- */
function Box({ x, y, w, h, title, sub, tone }: { x: number; y: number; w: number; h: number; title: string; sub?: string; tone: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={14} fill={`var(--${tone}-soft, #fff)`} stroke={`var(--${tone === "river" ? "monsoon" : tone})`} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 4 : h / 2 + 5)} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--text)">{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 15} textAnchor="middle" fontSize={11.5} fill="var(--mist)">{sub}</text>}
    </g>
  );
}
const Arrow = ({ x1, y1, x2, y2, label }: { x1: number; y1: number; x2: number; y2: number; label?: string }) => (
  <g>
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--mist)" strokeWidth={1.5} markerEnd="url(#docs-arrow)" />
    {label && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={10.5} fill="var(--dim)">{label}</text>}
  </g>
);
const Defs = () => (
  <defs><marker id="docs-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--mist)" /></marker></defs>
);

function ArchitectureDiagram() {
  return (
    <svg viewBox="0 0 960 400" className="docs-diagram" role="img" aria-label="Architecture: browser UI, Next.js API on Vercel, Python services, data stores and external sources">
      <Defs />
      <text x={20} y={26} fontSize={12} fontWeight={700} fill="var(--dim)" letterSpacing="0.08em">UI</text>
      <Box x={20} y={40} w={920} h={56} title="Browser: Next.js pages" sub="Overview · Map (2D/3D/before-after) · Forecast · Plan · Ask · Alerts · /docs" tone="river" />
      <text x={20} y={130} fontSize={12} fontWeight={700} fill="var(--dim)" letterSpacing="0.08em">API (Vercel)</text>
      <Box x={20} y={142} w={290} h={64} title="/api/assistant" sub="tool-use loop · grounding check" tone="home" />
      <Box x={335} y={142} w={290} h={64} title="/data/*.json (CDN)" sub="static pipeline outputs" tone="river" />
      <Box x={650} y={142} w={290} h={64} title="Edge middleware" sub="/docs switch + window" tone="watch" />
      <text x={20} y={238} fontSize={12} fontWeight={700} fill="var(--dim)" letterSpacing="0.08em">SERVICES</text>
      <Box x={20} y={250} w={210} h={60} title="LLM" sub="Gemini 2.5 Flash / Claude" tone="home" />
      <Box x={250} y={250} w={210} h={60} title="MCP server" sub="9 read-only tools" tone="home" />
      <Box x={480} y={250} w={460} h={60} title="Python pipeline" sub="radar → bank lines → hazard ML → outlook → exposure → planner" tone="ok" />
      <text x={20} y={342} fontSize={12} fontWeight={700} fill="var(--dim)" letterSpacing="0.08em">DATA</text>
      <Box x={20} y={352} w={440} h={40} title="Repo files: JSON / GeoJSON / CSV (PostGIS scaffold)" tone="river" />
      <Box x={480} y={352} w={460} h={40} title="NISAR · GIBS · POWER · GloFAS · GFS · OSM · Overture" tone="watch" />
      <Arrow x1={165} y1={96} x2={165} y2={142} label="ask" />
      <Arrow x1={480} y1={96} x2={480} y2={142} label="fetch" />
      <Arrow x1={795} y1={96} x2={795} y2={142} label="/docs" />
      <Arrow x1={125} y1={206} x2={125} y2={250} />
      <Arrow x1={260} y1={206} x2={330} y2={250} label="same tools" />
      <Arrow x1={710} y1={250} x2={520} y2={206} label="export" />
      <Arrow x1={710} y1={352} x2={710} y2={310} label="pull" />
      <Arrow x1={560} y1={310} x2={400} y2={352} />
    </svg>
  );
}

function DataFlowDiagram() {
  const steps = [
    { t: "Input", s: "NISAR radar · river forecast · rain · buildings", tone: "watch" },
    { t: "Processing", s: "water mask → bank lines → 500 m stretches", tone: "river" },
    { t: "AI", s: "hazard ML · planner · grounded assistant", tone: "home" },
    { t: "Output", s: "map · forecast · plan · Bangla alerts", tone: "ok" },
    { t: "Feedback", s: "next pass + news reports re-score the model", tone: "erosion" },
  ];
  return (
    <svg viewBox="0 0 960 210" className="docs-diagram" role="img" aria-label="Data flow: input, processing, AI, output, feedback">
      <Defs />
      {steps.map((st, i) => (
        <g key={st.t}>
          <rect x={10 + i * 190} y={30} width={160} height={96} rx={14} fill={`var(--${st.tone}-soft)`} stroke={`var(--${st.tone === "river" ? "monsoon" : st.tone})`} strokeWidth={1.5} />
          <text x={90 + i * 190} y={60} textAnchor="middle" fontSize={15} fontWeight={700} fill="var(--text)">{st.t}</text>
        </g>
      ))}
      {steps.map((st, i) => (
        <foreignObject key={st.t + "s"} x={18 + i * 190} y={80} width={144} height={44}>
          <div className="docs-fo">{st.s}</div>
        </foreignObject>
      ))}
      {steps.slice(0, -1).map((_, i) => <Arrow key={i} x1={170 + i * 190} y1={78} x2={200 + i * 190} y2={78} />)}
      <path d="M 850 126 C 850 190, 90 190, 90 130" fill="none" stroke="var(--erosion)" strokeWidth={1.5} strokeDasharray="5 5" markerEnd="url(#docs-arrow)" />
      <text x={470} y={196} textAnchor="middle" fontSize={11} fill="var(--erosion)">every 12 days the new pass checks the last forecast</text>
    </svg>
  );
}

/* ---------- page ---------- */
export default function Docs() {
  const hazard = useJson<Hazard>("hazard.json");
  const exposure = useJson<Exposure>("exposure.json");
  const score = useJson<Scorecard>("scorecard.json");
  const manifest = useJson<Manifest>("manifest.json");
  const outlook = useJson<Outlook>("outlook.json");
  const prio = useJson<Priorities>("priorities.json");
  const [q, setQ] = useState("");
  const [active, setActive] = useState("pitch");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [commits, setCommits] = useState<Commit[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Live health check of each data file behind a feature.
  useEffect(() => {
    const files = Array.from(new Set(FEATURES.map((f) => f.data).filter((x): x is string => Boolean(x))));
    Promise.all(files.map((f) => fetch(dataUrl(f), { method: "HEAD", cache: "no-store" }).then((r) => [f, r.ok] as const).catch(() => [f, false] as const)))
      .then((r) => setChecks(Object.fromEntries(r)));
  }, []);

  // Live changelog from GitHub (public API, no key). Falls back to a note if rate-limited.
  useEffect(() => {
    fetch(`https://api.github.com/repos/${REPO}/commits?per_page=30`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((rows: { sha: string; html_url: string; commit: { message: string; author: { date: string } } }[]) =>
        setCommits(rows.map((c) => ({ sha: c.sha.slice(0, 7), date: c.commit.author.date, message: c.commit.message.split("\n")[0], url: c.html_url }))))
      .catch(() => setCommits([]));
  }, []);

  // Tell admins when they are seeing a preview that the public cannot see.
  useEffect(() => {
    fetch("/api/docs-admin", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null))
      .then((s: { state: string; admin: boolean } | null) => { if (s && s.admin && s.state !== "open") setPreview(s.state); })
      .catch(() => undefined);
  }, []);

  // Search: hide sections without the query.
  useEffect(() => {
    const needle = q.trim().toLowerCase();
    document.querySelectorAll<HTMLElement>("[data-doc-section]").forEach((el) => {
      el.hidden = Boolean(needle) && !(el.textContent ?? "").toLowerCase().includes(needle);
    });
  }, [q]);

  // Highlight the section in view.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-doc-section]"));
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: "-20% 0px -70% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const best = hazard ? hazard.backtest.models[hazard.backtest.best] : null;
  const base = hazard ? hazard.backtest.models.base_rate : null;
  const planPeople = prio ? prio.default_plan.actions.reduce((s, a) => s + a.expected_people, 0) : null;

  const kpis = [
    { k: "People in the 36-day forecast zone", v: exposure ? nf(exposure.totals.people_in_high_zone_est) : "…", tone: "home" },
    { k: "Forecast skill (Brier, lower is better)", v: best && base ? `${best.brier.toFixed(3)} vs ${base.brier.toFixed(3)}` : "…", tone: "river" },
    { k: "Early warning before news reports", v: score ? `${score.summary.median_lead_days} days` : "…", tone: "ok" },
    { k: "NISAR passes processed", v: manifest ? String(manifest.passes.length) : "…", tone: "watch" },
  ];

  const markdown = useMemo(() => {
    const L: string[] = ["# NodiNajar: riverbank early warning", "", `Live app: ${typeof window === "undefined" ? "" : window.location.origin}`, `Code: https://github.com/${REPO}`, ""];
    L.push("## Key numbers (live)");
    kpis.forEach((x) => L.push(`- ${x.k}: ${x.v}`));
    L.push("", "## Pitch");
    PITCH.forEach((s) => { L.push(`### ${s.title}`); s.body.forEach((b) => L.push(`- ${b}`)); L.push(""); });
    L.push("## Team");
    TEAM.members.forEach((m) => L.push(`- ${m.name}: ${m.role}${m.email ? ` (${m.email})` : ""}`));
    L.push("", "## Feature matrix", "| Feature | Status | Note |", "|---|---|---|");
    FEATURES.forEach((f) => L.push(`| ${f.name} | ${STATUS[f.status].label} | ${f.note} |`));
    L.push("", "## Technology stack");
    STACK.forEach((s) => L.push(`- **${s.layer}:** ${s.items.join(", ")}`));
    L.push("", "## APIs exposed");
    APIS_EXPOSED.forEach((a) => L.push(`- \`${a.method} ${a.path}\`: ${a.returns} (auth: ${a.auth})`));
    L.push("", "## APIs used");
    APIS_USED.forEach((a) => L.push(`- ${a.name}: ${a.use}`));
    if (hazard) {
      L.push("", "## Model back-test", "| Model | Brier | AUC | Precision | Recall |", "|---|---|---|---|---|");
      Object.entries(hazard.backtest.models).forEach(([k, m]) => L.push(`| ${k} | ${m.brier} | ${m.auc} | ${m.precision} | ${m.recall} |`));
    }
    L.push("", "## Roadmap", `- Short term: ${ROADMAP.short.join("; ")}`, `- Mid term: ${ROADMAP.mid.join("; ")}`, `- Long term: ${ROADMAP.long.join("; ")}`);
    L.push("", "## Security");
    SECURITY.forEach((s) => L.push(`- ${s}`));
    return L.join("\n");
  }, [kpis, hazard]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = "NodiNajar-docs.md"; a.click();
    URL.revokeObjectURL(url);
  };
  const share = async () => {
    const link = `${window.location.origin}/docs/#${active}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { window.prompt("Copy this link", link); }
  };

  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  return (
    <>
      <main className="page docs-page">
        {preview && (
          <div className="docs-preview">Admin preview: the public cannot see this page right now ({preview === "off" ? "switched off" : preview === "not-yet" ? "window not open yet" : "window closed"}). <a href="/docs/admin/">Admin panel</a></div>
        )}

        <header className="docs-hero">
          <div>
            <span className="badge">DOCS · PITCH · LIVE SYSTEM</span>
            <h1>NodiNajar <span className="bn">নদীনজর</span></h1>
            <p>Radar that sees through monsoon cloud, a back-tested ML forecast and a response planner that tell Jamuna communities which 500 m of riverbank goes next, who lives there, and where a few crews protect the most people.</p>
            <div className="docs-actions">
              <a className="docs-btn primary" href="/">Open the app</a>
              <a className="docs-btn" href={`https://github.com/${REPO}`} target="_blank" rel="noreferrer">GitHub</a>
              <button className="docs-btn" onClick={download}>Export Markdown</button>
              <button className="docs-btn" onClick={() => window.print()}>Export PDF</button>
              <button className="docs-btn" onClick={share}>{copied ? "Link copied" : "Share link"}</button>
            </div>
          </div>
          <div className="docs-kpis">
            {kpis.map((x) => (
              <div key={x.k} className={`docs-kpi tone-${x.tone}`}><b>{x.v}</b><span>{x.k}</span></div>
            ))}
            <div className="docs-kpi-foot"><LiveTag when={manifest ? `data generated ${day(manifest.generated_utc)}` : undefined} /></div>
          </div>
        </header>

        <div className="docs-layout">
          <aside className="docs-nav" aria-label="Sections">
            <input className="docs-search" type="search" placeholder="Search the docs…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the docs" />
            {groups.map((g) => (
              <div key={g} className="docs-nav-group">
                <span>{g}</span>
                {NAV.filter((n) => n.group === g).map((n) => (
                  <a key={n.id} href={`#${n.id}`} className={active === n.id ? "on" : ""}>{n.label}</a>
                ))}
              </div>
            ))}
            <p className="docs-time">2 min: read the pitch. 10 min: read it all.</p>
          </aside>

          <div className="docs-body">
            <Section id="pitch" n="01" title="Pitch deck" lead="The business case in eleven slides. Numbers in the traction slide are read live from the app's data.">
              <div className="docs-slides">
                {PITCH.map((s, i) => (
                  <article key={s.id} id={`slide-${s.id}`} className="docs-slide">
                    <span className="docs-slide-n">{String(i + 1).padStart(2, "0")}</span>
                    <h3>{s.title}</h3>
                    <ul>{s.body.map((b) => <li key={b}>{b}</li>)}</ul>
                    {s.id === "traction" && hazard && score && exposure && (
                      <div className="docs-mini">
                        <div><b>{best ? best.auc.toFixed(2) : "–"}</b><span>AUC (base rate {base ? base.auc.toFixed(2) : "–"})</span></div>
                        <div><b>{score.summary.counts.warned ?? 0}/{score.summary.on_bank}</b><span>on-bank news events warned</span></div>
                        <div><b>{nf(exposure.totals.people_est)}</b><span>people counted near the bank</span></div>
                      </div>
                    )}
                    {s.id === "demo" && (
                      <div className="docs-links">
                        {[["/map/", "Map"], ["/forecast/", "Forecast"], ["/plan/", "Plan"], ["/assistant/", "Ask NodiNajar"], ["/alerts/", "Alerts"]].map(([h, l]) => <a key={h} href={h}>{l} →</a>)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </Section>

            <Section id="team" n="02" title={TEAM.name} lead="The people who built NodiNajar.">
              <div className="docs-team">
                {TEAM.members.map((m) => (
                  <div key={m.name} className="docs-member">
                    <Avatar m={m} />
                    <b>{m.name}</b>
                    <span>{m.role}</span>
                    {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>}
                  </div>
                ))}
              </div>
              <p className="docs-note">Builds on our earlier open-source work: <a href={ORIGINAL_REPO} target="_blank" rel="noreferrer">NodiNajar</a>. Commit history is in the <a href="#changelog">changelog</a>.</p>
            </Section>

            <Section id="overview" n="03" title="Product overview" lead={PRODUCT.what}>
              <div className="docs-grid2">
                <div className="docs-card"><h3>Who it is for</h3><ul>{PRODUCT.users.map((u) => <li key={u}>{u}</li>)}</ul></div>
                <div className="docs-card"><h3>Questions it answers</h3><ul>{PRODUCT.useCases.map((u) => <li key={u}>{u}</li>)}</ul></div>
              </div>
            </Section>

            <Section id="features" n="04" title="Feature matrix" lead="Status of every feature. For features backed by a data file, the check mark is a live request made when you opened this page.">
              <div className="table-wrap">
                <table className="data docs-table">
                  <thead><tr><th>Feature</th><th>Status</th><th>Live check</th><th>Notes</th></tr></thead>
                  <tbody>{FEATURES.map((f) => (
                    <tr key={f.name}>
                      <td>{f.page ? <a href={f.page}>{f.name}</a> : f.name}</td>
                      <td><span className={`docs-status ${STATUS[f.status].cls}`}>{STATUS[f.status].label}</span></td>
                      <td>{f.data ? (f.data in checks ? (checks[f.data] ? <span className="docs-ok">✓ {f.data}</span> : <span className="docs-bad">✗ {f.data}</span>) : "checking…") : <span className="dim">–</span>}</td>
                      <td className="dim">{f.note}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </Section>

            <Section id="architecture" n="05" title="Architecture" lead="UI → API → services → data. Everything heavy runs ahead of time in the Python pipeline; the web app serves its outputs and runs the assistant.">
              <div className="docs-card"><ArchitectureDiagram /></div>
            </Section>

            <Section id="dataflow" n="06" title="Data flow" lead="Input → processing → AI → output → feedback. Each new radar pass both feeds the next forecast and checks the last one.">
              <div className="docs-card"><DataFlowDiagram /></div>
            </Section>

            <Section id="stack" n="07" title="Technology stack">
              <div className="docs-stack">
                {STACK.map((s) => (
                  <div key={s.layer} className="docs-card"><h3>{s.layer}</h3><div className="docs-chips">{s.items.map((i) => <span key={i}>{i}</span>)}</div></div>
                ))}
              </div>
            </Section>

            <Section id="api" n="08" title="APIs" lead="What we call and what we expose. Model keys stay on the server.">
              <h3 className="docs-h3">Exposed</h3>
              <div className="table-wrap">
                <table className="data docs-table">
                  <thead><tr><th>Method</th><th>Endpoint</th><th>Auth</th><th>Body</th><th>Returns</th></tr></thead>
                  <tbody>{APIS_EXPOSED.map((a) => (
                    <tr key={a.method + a.path}><td><code>{a.method}</code></td><td><code>{a.path}</code></td><td>{a.auth}</td><td><code>{a.body}</code></td><td className="dim">{a.returns}</td></tr>))}</tbody>
                </table>
              </div>
              <h3 className="docs-h3">Used</h3>
              <div className="docs-grid2">{APIS_USED.map((a) => <div key={a.name} className="docs-card slim"><b>{a.name}</b><span className="dim">{a.use}</span></div>)}</div>
            </Section>

            <Section id="data" n="09" title="Data layer" lead="Open data only. Every number in the app carries its source and date.">
              <div className="docs-grid2">
                <div className="docs-card">
                  <h3>Sources and parsing</h3>
                  <ul>
                    <li>NISAR GCOV HDF5 read with h5py (only the study area, by HTTP range reads)</li>
                    <li>Speckle filter → water mask (season-fallback threshold) → outer bank lines → 500 m stretches</li>
                    <li>Water masks checked against NASA OPERA DSWx-HLS (94–96% agreement)</li>
                    <li>River outlook {outlook ? <>fetched <b>{day(outlook.fetched_utc)}</b> ({outlook.river.gauge}: {outlook.river.trend}, {outlook.river.band})</> : "…"}</li>
                  </ul>
                </div>
                <div className="docs-card">
                  <h3>Storage and privacy</h3>
                  <ul>
                    <li>Pipeline outputs are versioned JSON/GeoJSON/CSV in the repo, served from the CDN</li>
                    <li>Homes are building points (Overture); people = homes × {exposure ? exposure.household_size : "3.98"} ({exposure ? exposure.household_source : "BBS Census 2022"})</li>
                    <li>No names, phone numbers or personal records are stored</li>
                    <li>Radar data labelled PROVISIONAL, forecasts labelled MODEL FORECAST</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="ai" n="10" title="AI layer" lead="A trained ML model makes the forecast; a language model only explains it, using tools, and every number it says is checked.">
              <div className="docs-grid2">
                <div className="docs-card">
                  <h3>Erosion-hazard model <LiveTag /></h3>
                  <p className="dim">Probability that a stretch moves ≥ 30 m inland by the next pass. {hazard ? <>Trained on {hazard.n_rows} stretch-pass rows, base rate {(hazard.base_rate * 100).toFixed(0)}%, rolling back-test on passes {hazard.backtest.tested_passes.join(", ")}. Status: {hazard.status}.</> : "…"}</p>
                  {hazard && (
                    <div className="table-wrap">
                      <table className="data docs-table">
                        <thead><tr><th>Model</th><th>Brier ↓</th><th>AUC ↑</th><th>Precision</th><th>Recall</th></tr></thead>
                        <tbody>{Object.entries(hazard.backtest.models).sort((a, b) => a[1].brier - b[1].brier).map(([k, m]) => (
                          <tr key={k} className={k === hazard.backtest.best ? "docs-best" : ""}><td>{k === "gboost" ? "Gradient-boosted trees" : k.replace("_", " ")}{k === hazard.backtest.best && " ★"}</td><td className="num">{m.brier.toFixed(3)}</td><td className="num">{m.auc.toFixed(3)}</td><td className="num">{m.precision.toFixed(2)}</td><td className="num">{m.recall.toFixed(2)}</td></tr>))}</tbody>
                      </table>
                    </div>
                  )}
                </div>
                <div className="docs-card">
                  <h3>Explainability</h3>
                  <p className="dim">The {hazard ? hazard.features.length : 9} signals the model uses; each stretch page shows which pushed its probability up or down.</p>
                  <ul>{hazard ? hazard.features.map((f) => <li key={f.name}>{f.label}</li>) : <li>…</li>}</ul>
                </div>
                <div className="docs-card">
                  <h3>Assistant (Ask NodiNajar)</h3>
                  <ul>
                    <li>Gemini 2.5 Flash function calling (Claude tool use as an alternative), max 6 tool steps, last 10 messages kept</li>
                    <li>9 read-only tools, the same ones the MCP server exposes</li>
                    <li>Retrieval (RAG): TF-IDF over the methods, model card, coverage notes and news-report table; sources shown under each answer</li>
                    <li>Answers in the user's language: Bangla or English</li>
                  </ul>
                </div>
                <div className="docs-card">
                  <h3>Guardrails</h3>
                  <ul>
                    <li>Every number in an answer must appear in the tool results (Bangla digits included), otherwise it is flagged</li>
                    <li>Alerts only from fixed templates; the AI never writes alert text</li>
                    <li>Known limit found in testing: a number that appears elsewhere in the evidence can pass. Fix on the roadmap: match each number to its stretch.</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section id="roadmap" n="11" title="Product roadmap">
              <div className="docs-roadmap">
                {([["Short term", "now → 3 months", ROADMAP.short], ["Mid term", "2027 monsoon", ROADMAP.mid], ["Long term", "after the pilot", ROADMAP.long]] as const).map(([t, w, items]) => (
                  <div key={t} className="docs-card"><span className="docs-when">{w}</span><h3>{t}</h3><ul>{items.map((i) => <li key={i}>{i}</li>)}</ul></div>
                ))}
              </div>
            </Section>

            <Section id="performance" n="12" title="Performance & scalability">
              <div className="docs-card"><ul>{PERFORMANCE.map((p) => <li key={p}>{p}</li>)}</ul></div>
            </Section>

            <Section id="security" n="13" title="Security">
              <div className="docs-card"><ul>{SECURITY.map((p) => <li key={p}>{p}</li>)}</ul></div>
            </Section>

            <Section id="analytics" n="14" title="Analytics & KPIs" lead="Impact and model KPIs, read live from the app's data.">
              <div className="docs-kpi-grid">
                <div className="docs-kpi tone-home"><b>{exposure ? nf(exposure.totals.people_in_high_zone_est) : "…"}</b><span>people in the 36-day high-end forecast zone ({exposure ? nf(exposure.totals.homes_in_high_zone) : "…"} homes)</span></div>
                <div className="docs-kpi tone-ok"><b>{planPeople !== null ? nf(planPeople) : "…"}</b><span>expected people protected by the default plan ({prio ? `${prio.default_plan.crews} crews, ${prio.default_plan.shelter} shelter places` : "…"})</span></div>
                <div className="docs-kpi tone-erosion"><b>{manifest ? `${nf(manifest.totals.land_lost_ha, 1)} ha` : "…"}</b><span>land lost this season (confirmed on two passes)</span></div>
                <div className="docs-kpi tone-watch"><b>{manifest ? `${manifest.totals.cells_red} red · ${manifest.totals.cells_amber} amber` : "…"}</b><span>stretches at risk</span></div>
                <div className="docs-kpi tone-river"><b>{score ? `${score.summary.median_lead_days} days` : "…"}</b><span>median lead before newspaper reports ({score ? `${score.summary.counts.warned ?? 0} warned, ${score.summary.counts.late ?? 0} late` : "…"})</span></div>
                <div className="docs-kpi tone-river"><b>12 days</b><span>radar cycle, plus a daily river outlook</span></div>
              </div>
              <p className="docs-note">Usage analytics are not collected: the app has no tracking or accounts.</p>
            </Section>

            <Section id="changelog" n="15" title="Changelog" lead="Live from the GitHub repository.">
              <div className="docs-card">
                {commits === null && <p className="dim">Loading commits…</p>}
                {commits && commits.length === 0 && <p className="dim">GitHub did not answer (rate limit). See <a href={`https://github.com/${REPO}/commits/main`} target="_blank" rel="noreferrer">the commit history</a>.</p>}
                {commits && commits.length > 0 && (
                  <ol className="docs-log">{commits.map((c) => (
                    <li key={c.sha}><a href={c.url} target="_blank" rel="noreferrer"><code>{c.sha}</code></a><span className="dim">{day(c.date)}</span><span>{c.message}</span></li>))}</ol>
                )}
              </div>
            </Section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
