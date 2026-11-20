"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorBox, Loading } from "@/components/Bits";
import { Footer } from "@/components/Shell";
import { Bar, Dial, PersonGlyph, RibbonLegend, Ring, RiverRibbon, probColor } from "@/components/Visuals";
import { useRiver } from "@/lib/data";
import { useJson } from "@/lib/extra";
import { fmtDate, nf } from "@/lib/format";
import { MODEL_NAMES, pct, type ExposureFile, type HazardFile, type OutlookFile, type PrioritiesFile } from "@/lib/shield";

const axis = { stroke: "#7d8b8e", tick: { fill: "#7d8b8e", fontSize: 11.5 }, tickLine: false, axisLine: { stroke: "#ebe4d7" } };
const tip = { contentStyle: { background: "#fff", border: "1px solid #e7e0d3", borderRadius: 14, color: "#15282e", fontSize: 12.5, boxShadow: "0 12px 32px rgba(21,40,46,.12)" } };
const SHORT: Record<string, string> = {
  last_change_m: "Moved last pass", prev_change_m: "Moved before that", position_m: "Total movement", trend_m_per_12d: "Steady trend",
  water_km2: "River size", water_change_km2: "River change", rain_mm: "Recent rain", east_bank: "Bank side", river_rising_next: "River rising",
};
type Scen = "river_rising" | "river_not_rising";

function RiverCard({ o }: { o: OutlookFile | null }) {
  if (!o) return (
    <div className="card tint-river"><h3>River outlook</h3><p className="muted">Not fetched in this build. Run <code>python tools/fetch_outlook.py</code>.</p></div>
  );
  const g = o.gauges[0];
  const rows = g.days.map((d) => ({ date: d.date, q: d.q, band: d.clim_p50 !== null && d.clim_p90 !== null ? [d.clim_p50, d.clim_p90] : null, p50: d.clim_p50 }));
  return (
    <div className="card tint-river">
      <div className="card-head">
        <div><h3>The river, next 30 days</h3><p className="sub">{g.name} · Copernicus GloFAS v4 · fetched {fmtDate(o.fetched_utc.slice(0, 10))}</p></div>
        <span className="pill blue">forecast</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 18, alignItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Dial pct={g.today.pct} size={190} />
          <div style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 600, textTransform: "capitalize", marginTop: -4 }}>{g.today.band}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>{g.trend_7d.trend} next 7 days</div>
        </div>
        <ResponsiveContainer width="100%" height={210}>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="qfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0f7c8c" stopOpacity={0.35} /><stop offset="1" stopColor="#0f7c8c" stopOpacity={0.02} /></linearGradient>
            </defs>
            <CartesianGrid stroke="#ebe4d7" strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="date" {...axis} tickFormatter={(d: string) => fmtDate(d)} minTickGap={34} />
            <YAxis {...axis} width={52} tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} />
            <Tooltip {...tip} labelFormatter={(d) => fmtDate(String(d), true)}
              formatter={((v: number | number[], n: string) => [Array.isArray(v) ? `${nf(v[0])}–${nf(v[1])} m³/s` : `${nf(v)} m³/s`, n]) as never} />
            <Area dataKey="band" name="usual range, past years" fill="#d0901c" fillOpacity={0.12} stroke="none" />
            <Line dataKey="p50" name="median, past years" stroke="#b9a98a" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
            <Area dataKey="q" name="GloFAS discharge" stroke="#0f7c8c" strokeWidth={2.6} fill="url(#qfill)" />
            <ReferenceLine x={g.today.date} stroke="#15282e" strokeDasharray="3 3" label={{ value: "today", fill: "#5d6e72", fontSize: 11, position: "insideTopRight" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {o.basin_rain.median_mm !== null && (
        <p className="note">Rain upstream next {o.basin_rain.days} days (NOAA GFS): typical {o.basin_rain.median_mm} mm, wettest {o.basin_rain.wettest} {o.basin_rain.max_mm} mm.</p>
      )}
    </div>
  );
}

export default function Forecast() {
  const { data, error } = useRiver();
  const hz = useJson<HazardFile>("hazard.json");
  const ex = useJson<ExposureFile>("exposure.json");
  const pri = useJson<PrioritiesFile>("priorities.json");
  const ol = useJson<OutlookFile>("outlook.json");
  const [scen, setScen] = useState<"auto" | Scen>("auto");
  const [showAll, setShowAll] = useState(false);
  const active: Scen = scen === "auto" ? ((pri?.scenario as Scen | undefined) ?? "river_not_rising") : scen;

  const rows = useMemo(() => {
    if (!hz) return [];
    const exp = new Map((ex?.stretches ?? []).map((e) => [e.id, e]));
    const pr = new Map((pri?.stretches ?? []).map((e) => [e.id, e]));
    return hz.stretches.filter((s) => s.scenarios).map((s) => ({
      id: s.id, level: s.level, p: s.scenarios![active].p,
      driver: s.scenarios![active].drivers[0], exp: exp.get(s.id), pri: pr.get(s.id),
    })).sort((a, b) => b.p - a.p || (a.id < b.id ? -1 : 1));
  }, [hz, ex, pri, active]);
  const prob = useMemo(() => new Map(rows.map((r) => [r.id, r.p])), [rows]);
  const people = useMemo(() => new Map((ex?.stretches ?? []).map((e) => [e.id, e.people_in_high_zone_est || e.people_est])), [ex]);

  if (error) return <ErrorBox error={error} />;
  if (!data || !hz) return <Loading what="the forecast" />;
  const segs = data.segments.features.map((f) => f.properties);
  const bt = hz.backtest;
  const best = bt.models[hz.model];
  const likely = rows.filter((r) => r.p >= 0.5).length;
  const shown = showAll ? rows : rows.slice(0, 12);
  const models = Object.entries(bt.models).sort((a, b) => a[1].brier - b[1].brier);
  const maxBrier = Math.max(...models.map(([, m]) => m.brier));

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">AI forecast · next radar pass</div>
            <h2>Which stretches move next</h2>
            <p>A machine-learning model reads each stretch&apos;s recent movement, the river and the rain, and gives the chance it moves 30 m or more inland by the next pass.</p>
          </div>
          <div className="seg" role="group" aria-label="River scenario">
            {(["auto", "river_rising", "river_not_rising"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scen === s} onClick={() => setScen(s)}>
                {s === "auto" ? "Today's river" : s === "river_rising" ? "If the river rises" : "If it doesn't"}
              </button>
            ))}
          </div>
        </div>

        <section className="grid g-3">
          <div className="card lift" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Ring value={likely} total={rows.length} color="#cf4a2f" label={<><b>{likely}</b><span>of {rows.length}</span></>} />
            <div><h3>Likely to move</h3><p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Stretches with a 50% or higher chance of moving 30 m+ by the next pass.</p></div>
          </div>
          <div className="card lift" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Ring value={(best.auc ?? 0.5) - 0.5} total={0.5} color="#7356d0" label={<><b>{best.auc ?? "–"}</b><span>AUC</span></>} />
            <div><h3>Tested, not guessed</h3><p className="muted" style={{ margin: 0, fontSize: 13.5 }}>On {best.n} checks it never saw, it ranked moving banks above stable ones {Math.round((best.auc ?? 0) * 100)}% of the time.</p></div>
          </div>
          <div className="card lift" style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <Ring value={ex?.totals.people_in_high_zone_est ?? 0} total={ex?.totals.people_est ?? 1} color="#7356d0"
              label={<><b>{ex ? nf(ex.totals.people_in_high_zone_est) : "–"}</b><span>people</span></>} />
            <div><h3>In the way</h3><p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Live where the high-end forecast reaches within 36 days, out of {ex ? nf(ex.totals.people_est) : "–"} near the moving banks.</p></div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <div className="card-head">
            <div><h3>Risk along the river</h3><p className="sub">Each dot is a 500 m stretch. Colour is the chance of moving; size is people in the way. Hover or tap a dot.</p></div>
            <Link className="btn sm" href="/plan/">Turn this into a plan →</Link>
          </div>
          <div className="ribbon-wrap light">
            <RiverRibbon banklines={data.banklines} segs={segs.filter((s) => prob.has(s.id))} bbox={data.manifest.aoi_bbox} prob={prob} people={people}
              onPick={(id) => (window.location.href = `/map/?seg=${id}`)} />
            <RibbonLegend mode="prob" />
          </div>
        </section>

        <section className="grid g-3" style={{ marginTop: 18 }}>
          <div className="card span-2">
            <div className="card-head">
              <div><h3>Ranked by chance of moving</h3><p className="sub">From the last radar pass ({fmtDate(hz.from_pass, true)}). The chip shows what pushed the forecast most.</p></div>
            </div>
            <div className="prob-list">
              {shown.map((r) => (
                <Link key={r.id} href={`/map/?seg=${r.id}`} className="prob-row">
                  <span className="prob-id"><span className={`lvl-dot ${r.level}`} />{r.id}</span>
                  <Bar value={r.p} color={probColor(r.p)} mark={0.5} />
                  <span className="prob-pct">{pct(r.p)}</span>
                  <span className="prob-driver"><span className="chip-s" title={r.driver?.label}>{r.driver ? `${r.driver.effect >= 0 ? "▲" : "▼"} ${SHORT[r.driver.feature] ?? r.driver.label}` : "–"}</span></span>
                  <span className="prob-people people-chip"><PersonGlyph /> {r.exp ? nf(r.exp.people_in_high_zone_est) : "–"}</span>
                </Link>
              ))}
            </div>
            {rows.length > 12 && <button type="button" className="btn sm" style={{ marginTop: 12 }} onClick={() => setShowAll(!showAll)}>{showAll ? "Show top 12" : `Show all ${rows.length}`}</button>}
          </div>
          <div className="card">
            <h3>How good is it?</h3>
            <p className="sub">Error on passes the model never saw. Shorter bar = better.</p>
            <div className="skill">
              {models.map(([k, mm]) => (
                <div key={k} className={`skill-row${k === hz.model ? " best" : ""}`}>
                  <span>{MODEL_NAMES[k] ?? k}{k === hz.model && " ★"}</span>
                  <Bar value={mm.brier} max={maxBrier} color={k === hz.model ? "#7356d0" : k === "logistic" ? "#a99be0" : "#cfc6b4"} />
                  <span className="num" style={{ textAlign: "right" }}>{mm.brier.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="note">★ is the model in use. It beats &ldquo;guess the average&rdquo; and our old trend line. Adding the river forecast improves it slightly ({hz.backtest_without_outlook.models[hz.model].brier.toFixed(3)} → {best.brier.toFixed(3)}).</p>
            <details className="more-info">
              <summary>Limits</summary>
              <p className="muted" style={{ fontSize: 13 }}>One monsoon, {hz.n_rows} labelled examples, stretches chosen because they moved. Part of the measured movement follows the waterline. Use it to rank, not as an exact probability. Full model card: docs/MODEL_CARD.md.</p>
            </details>
          </div>
        </section>

        <section style={{ marginTop: 18 }}><RiverCard o={ol} /></section>
      </main>
      <Footer />
    </>
  );
}
