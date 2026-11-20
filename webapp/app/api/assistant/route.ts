/**
 * NodiNajar assistant: a tool-using Claude agent for upazila officers, NGOs and journalists.
 *
 * - The model can only read the pipeline outputs through the tools below (same tools as mcp_server/server.py).
 * - Every number in the answer is checked against the tool results (lib/shield.ts checkGrounding);
 *   ungrounded numbers are returned to the page, which shows a warning.
 * - Alerts are never written by the model: alert_for returns the fixed template.
 *
 * Env (set one): ANTHROPIC_API_KEY (+ ANTHROPIC_MODEL, default claude-sonnet-5-5)
 *   or GEMINI_API_KEY, free from Google AI Studio (+ GEMINI_MODEL, default gemini-2.5-flash).
 * If both are set, Claude is used.
 */
import { alertText, audience } from "@/lib/alerts";
import { checkGrounding, plan, type ExposureFile, type HazardFile, type OutlookFile, type PrioritiesFile } from "@/lib/shield";
import type { Manifest, Segments } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const MAX_STEPS = 6;

const SYSTEM = `You are the NodiNajar assistant. NodiNajar measures Jamuna riverbank movement in Sirajganj, Bangladesh, from NASA-ISRO NISAR L-band radar (provisional data, 8 passes, 18 Jun to 22 Sep 2026), forecasts which 500 m stretches move next with a back-tested ML model, adds a daily Copernicus GloFAS river outlook, counts homes and people in the way, and plans where crews and shelter places help most.
Rules:
- Use the tools. Quote numbers only from tool results; never estimate, round differently or invent numbers.
- Name stretch IDs (like C011). Say "forecast" for predictions and "provisional" for radar measurements.
- Alerts: only use alert_for, which returns the official fixed template. Never write alert text yourself.
- If the data cannot answer, say so and say which tool or dataset would be needed.
- Answer in the user's language (Bangla or English). Keep answers short: a few sentences or a short list.`;

type Json = Record<string, unknown>;
interface Ctx { base: string; cache: Map<string, Promise<unknown>> }

async function load<T>(ctx: Ctx, file: string): Promise<T | null> {
  if (!ctx.cache.has(file)) {
    ctx.cache.set(file, fetch(`${ctx.base}/data/${file}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null));
  }
  return ctx.cache.get(file) as Promise<T | null>;
}

const TOOLS = [
  { name: "season_summary", description: "Season totals (stretches at risk, land lost, homes near the new bank), pass dates, data status, exposure totals.", input_schema: { type: "object", properties: {} } },
  { name: "list_stretches", description: "Bank stretches ranked by priority (red first, then by movement). Optional level filter.", input_schema: { type: "object", properties: { level: { type: "string", enum: ["red", "amber"] }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
  { name: "get_stretch", description: "Everything about one 500 m stretch: measured movement by pass, ML hazard probability and drivers, exposure, priority.", input_schema: { type: "object", properties: { stretch_id: { type: "string" } }, required: ["stretch_id"] } },
  { name: "river_outlook", description: "Jamuna discharge today vs past years, 7-day trend and forecast peak (Copernicus GloFAS), basin rain (NOAA GFS).", input_schema: { type: "object", properties: {} } },
  { name: "model_report", description: "How the ML hazard model was back-tested and how it compares with baselines.", input_schema: { type: "object", properties: {} } },
  { name: "plan_response", description: "Allocate geobag crews (one stretch each) and shelter places to protect the most people.", input_schema: { type: "object", properties: { crews: { type: "integer", minimum: 0, maximum: 50 }, shelter: { type: "integer", minimum: 0, maximum: 20000 } } } },
  { name: "alert_for", description: "The official fixed-template alert for a stretch (Bangla 'bn' or English 'en') and its recipients.", input_schema: { type: "object", properties: { stretch_id: { type: "string" }, lang: { type: "string", enum: ["bn", "en"] } }, required: ["stretch_id"] } },
  { name: "search_knowledge", description: "Search the methods, model card, coverage notes and 2026 newspaper erosion reports. Returns cited text chunks.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
];

const tok = (s: string) => s.toLowerCase().match(/[a-z0-9ঀ-৿]+/g) ?? [];

async function runTool(ctx: Ctx, name: string, input: Json): Promise<Json> {
  const m = await load<Manifest>(ctx, "manifest.json");
  const segs = await load<Segments>(ctx, "segments.geojson");
  if (!m || !segs) return { error: "data not available" };
  const props = segs.features.map((f) => f.properties);
  const byId = (id: unknown) => props.find((p) => p.id === String(id ?? "").toUpperCase());
  const hz = await load<HazardFile>(ctx, "hazard.json");
  const ex = await load<ExposureFile>(ctx, "exposure.json");
  const pri = await load<PrioritiesFile>(ctx, "priorities.json");
  switch (name) {
    case "season_summary":
      return { label: m.label, first_pass: m.passes[0].date, last_pass: m.passes[m.passes.length - 1].date, n_passes: m.passes.length,
        totals: m.totals, risk_rule: m.method.risk_rule, exposure_totals: ex?.totals ?? null };
    case "list_stretches": {
      const level = input.level as string | undefined;
      const limit = Math.max(1, Math.min(Number(input.limit ?? 10), 50));
      const rows = props.filter((p) => !level || p.level === level).sort((a, b) => Number(a.level !== "red") - Number(b.level !== "red") || b.retreat_m - a.retreat_m)
        .map((p) => { const q = pri?.stretches.find((x) => x.id === p.id); return { id: p.id, level: p.level, side: p.side, retreat_m: p.retreat_m, homes_near: p.homes_near, lat: p.centre[1], lon: p.centre[0], p_next_pass: q?.p ?? null, priority: q?.priority ?? null }; });
      return { count: rows.length, stretches: rows.slice(0, limit) };
    }
    case "get_stretch": {
      const p = byId(input.stretch_id);
      if (!p) return { error: `unknown stretch ${input.stretch_id}` };
      return { id: p.id, level: p.level, side: p.side, centre_lon_lat: p.centre, retreat_m: p.retreat_m, land_lost_ha: p.lost_ha, homes_within_200m: p.homes_near,
        bank_position_m_by_pass: Object.fromEntries(m.passes.map((x, i) => [x.date, p.history_m[i]])),
        ml_hazard: hz?.stretches.find((s) => s.id === p.id)?.scenarios ?? null,
        exposure: ex?.stretches.find((s) => s.id === p.id) ?? null, priority: pri?.stretches.find((s) => s.id === p.id) ?? null };
    }
    case "river_outlook": {
      const o = await load<OutlookFile>(ctx, "outlook.json");
      if (!o) return { error: "river outlook not fetched in this build" };
      return { source: o.source, fetched_utc: o.fetched_utc, river: o.river,
        gauges: o.gauges.map((g) => ({ name: g.name, today: g.today, trend_7d: g.trend_7d, peak: g.peak })),
        basin_rain: { days: o.basin_rain.days, median_mm: o.basin_rain.median_mm, max_mm: o.basin_rain.max_mm, wettest: o.basin_rain.wettest } };
    }
    case "model_report":
      if (!hz) return { error: "model output missing" };
      return { label: hz.label, model: hz.model, n_rows: hz.n_rows, base_rate: hz.base_rate, backtest: hz.backtest,
        backtest_without_outlook: hz.backtest_without_outlook, learned_beats_baselines: hz.learned_beats_baselines, status: hz.status };
    case "plan_response":
      if (!pri) return { error: "priorities missing" };
      return { scenario: pri.scenario, ...plan(pri.stretches, Number(input.crews ?? 5), Number(input.shelter ?? 500)) };
    case "alert_for": {
      const p = byId(input.stretch_id);
      if (!p) return { error: `unknown stretch ${input.stretch_id}` };
      if (p.level !== "red" && p.level !== "amber") return { error: "no alert: stretch is not red or amber" };
      const lang = input.lang === "en" ? "en" : "bn";
      return { id: p.id, text: alertText(p, m.period_days, lang), audience: audience(p.level) };
    }
    case "search_knowledge": {
      const kb = await load<{ chunks: { id: number; source: string; title: string; text: string; url?: string }[] }>(ctx, "knowledge.json");
      if (!kb) return { error: "knowledge base missing" };
      const docs = kb.chunks.map((c) => tok(`${c.title} ${c.text}`));
      const N = docs.length, df = new Map<string, number>();
      docs.forEach((d) => new Set(d).forEach((t) => df.set(t, (df.get(t) ?? 0) + 1)));
      const q = [...new Set(tok(String(input.query ?? "")))];
      const scored = docs.map((d, i) => {
        let s = 0;
        for (const t of q) { const tf = d.filter((x) => x === t).length; if (tf) s += (1 + Math.log(tf)) * Math.log(1 + N / (df.get(t) ?? 1)); }
        return { i, s: s / Math.sqrt(d.length + 1) };
      }).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 4);
      return { results: scored.map(({ i }) => ({ source: kb.chunks[i].source, title: kb.chunks[i].title, text: kb.chunks[i].text, url: kb.chunks[i].url })) };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}

interface Block { type: string; text?: string; id?: string; name?: string; input?: Json }
interface Msg { role: "user" | "assistant"; content: string | Json[] | Block[] }

interface Ctl { used: { name: string; input: Json }[]; evidence: string[]; sources: Map<string, string | undefined> }

async function callTool(ctx: Ctx, ctl: Ctl, name: string, input: Json): Promise<string> {
  const res = await runTool(ctx, name, input);
  ctl.used.push({ name, input });
  const text = JSON.stringify(res);
  ctl.evidence.push(text);
  if (name === "search_knowledge" && Array.isArray(res.results)) {
    for (const c of res.results as { source: string; url?: string }[]) ctl.sources.set(c.source, c.url);
  }
  return text.slice(0, 20000);
}

function done(answer: string, ctl: Ctl, model: string) {
  return Response.json({ answer, tools: ctl.used, grounding: checkGrounding(answer, ctl.evidence),
    sources: [...ctl.sources].map(([source, url]) => ({ source, url })), model });
}

async function runClaude(key: string, history: Msg[], ctx: Ctx, ctl: Ctl): Promise<Response> {
  const messages: Msg[] = [...history];
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 1024, system: SYSTEM, tools: TOOLS, messages }),
    });
    if (!r.ok) return Response.json({ error: `model call failed (${r.status})` }, { status: 502 });
    const out = (await r.json()) as { content: Block[]; stop_reason: string };
    if (out.stop_reason !== "tool_use") {
      return done(out.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim(), ctl, MODEL);
    }
    messages.push({ role: "assistant", content: out.content });
    const results: Json[] = [];
    for (const b of out.content.filter((x) => x.type === "tool_use")) {
      results.push({ type: "tool_result", tool_use_id: b.id, content: await callTool(ctx, ctl, b.name!, b.input ?? {}) });
    }
    messages.push({ role: "user", content: results });
  }
  return Response.json({ error: "the assistant took too many steps; try a narrower question" }, { status: 500 });
}

interface GPart { text?: string; functionCall?: { name: string; args?: Json }; functionResponse?: { name: string; response: Json } }
interface GContent { role: "user" | "model"; parts: GPart[] }

const GEMINI_TOOLS = [{
  functionDeclarations: TOOLS.map((t) => {
    const props = (t.input_schema as { properties?: Json }).properties ?? {};
    return Object.keys(props).length ? { name: t.name, description: t.description, parameters: t.input_schema } : { name: t.name, description: t.description };
  }),
}];

async function runGemini(key: string, history: Msg[], ctx: Ctx, ctl: Ctl): Promise<Response> {
  const contents: GContent[] = history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] }));
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  for (let step = 0; step < MAX_STEPS; step++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: SYSTEM }] }, contents, tools: GEMINI_TOOLS,
        generationConfig: { maxOutputTokens: 1024, temperature: 0.2 } }),
    });
    if (r.status === 429) return Response.json({ error: "The free AI quota is used up for now. Please try again in a minute." }, { status: 429 });
    if (!r.ok) return Response.json({ error: `model call failed (${r.status})` }, { status: 502 });
    const out = (await r.json()) as { candidates?: { content?: GContent }[] };
    const parts = out.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) {
      const answer = parts.map((p) => p.text ?? "").join("").trim();
      return answer ? done(answer, ctl, GEMINI_MODEL) : Response.json({ error: "the model returned no answer; try rephrasing" }, { status: 502 });
    }
    contents.push({ role: "model", parts });
    const responses: GPart[] = [];
    for (const p of calls) {
      const name = p.functionCall!.name;
      const text = await callTool(ctx, ctl, name, p.functionCall!.args ?? {});
      responses.push({ functionResponse: { name, response: { result: JSON.parse(text.length < 20000 ? text : JSON.stringify({ truncated: text })) } } });
    }
    contents.push({ role: "user", parts: responses });
  }
  return Response.json({ error: "the assistant took too many steps; try a narrower question" }, { status: 500 });
}

export async function POST(req: Request) {
  const claudeKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!claudeKey && !geminiKey) {
    return Response.json({ error: "The assistant is not configured on this deployment (set GEMINI_API_KEY or ANTHROPIC_API_KEY)." }, { status: 503 });
  }
  let body: { messages?: { role: "user" | "assistant"; content: string }[] };
  try { body = await req.json(); } catch { return Response.json({ error: "bad request" }, { status: 400 }); }
  const history: Msg[] = (body.messages ?? []).filter((x) => typeof x.content === "string" && x.content.trim()).slice(-10)
    .map((x) => ({ role: x.role, content: x.content.slice(0, 4000) }));
  if (!history.length || history[history.length - 1].role !== "user") return Response.json({ error: "no question" }, { status: 400 });
  const ctx: Ctx = { base: new URL(req.url).origin, cache: new Map() };
  const ctl: Ctl = { used: [], evidence: [], sources: new Map() };
  try {
    return claudeKey ? await runClaude(claudeKey, history, ctx, ctl) : await runGemini(geminiKey!, history, ctx, ctl);
  } catch {
    return Response.json({ error: "the AI service could not be reached; try again" }, { status: 502 });
  }
}
