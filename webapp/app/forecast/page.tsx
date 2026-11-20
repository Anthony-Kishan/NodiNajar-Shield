"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorBox, Kpi, LevelPill, Loading } from "@/components/Bits";
import { Footer } from "@/components/Shell";
import { useRiver } from "@/lib/data";
import { useJson } from "@/lib/extra";
import { fmtDate, nf } from "@/lib/format";
import { MODEL_NAMES, pct, type ExposureFile, type HazardFile, type OutlookFile, type PrioritiesFile } from "@/lib/shield";
import type { Level } from "@/lib/types";

const axis = { stroke: "#93a9b4", tick: { fill: "#93a9b4", fontSize: 11.5 }, tickLine: false, axisLine: { stroke: "#24404f" } };
const tip = { contentStyle: { background: "rgba(13,27,36,.96)", border: "1px solid #2f5163", borderRadius: 10, color: "#e8eef1", fontSize: 12.5 } };
const bandPill = (b: string) => (b === "very high" ? "red" : b === "high" ? "amber" : b === "low" ? "grey" : "blue");

function OutlookCard({ o }: { o: OutlookFile | null }) {
  if (!o) {
    return (
      <div className="card">
        <h3>River outlook</h3>
        <p className="sub">Daily Jamuna discharge forecast (Copernicus GloFAS) and basin rain (NOAA GFS).</p>
        <p className="note warn">Not fetched in this build. Run <code>python tools/fetch_outlook.py</code> and then <code>python -m src.pipeline.export_shield</code>. No account or key is needed.</p>
      </div>
    );
  }
  const g = o.gauges[0];
  const rows = g.days.map((d) => ({ date: d.date, q: d.q, p50: d.clim_p50, p90: d.clim_p90 }));
  const today = g.today.date;
  return (
    <div className="card">
      <div className="card-head">
        <div><h3>River outlook · {g.name}</h3><p className="sub">GloFAS v4 discharge with the same days in past years (median and 90th percentile). Fetched {o.fetched_utc.slice(0, 10)}.</p></div>
        <span className="pill grey">MODEL FORECAST</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <span className={`pill ${bandPill(g.today.band)}`}>Today: {g.today.band} ({g.today.pct ?? "?"}th percentile)</span>
        <span className={`pill ${g.trend_7d.trend === "rising" ? "amber" : "grey"}`}>Next 7 days: {g.trend_7d.trend}{g.trend_7d.change_pct !== null && ` (${g.trend_7d.change_pct > 0 ? "+" : ""}${g.trend_7d.change_pct}%)`}</span>
        <span className="pill grey">Peak {nf(g.peak.q)} m³/s on {fmtDate(g.peak.date)}</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#24404f" strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey="date" {...axis} tickFormatter={(d) => fmtDate(d)} minTickGap={30} />
          <YAxis {...axis} width={60} tickFormatter={(v) => nf(v)} />
          <Tooltip {...tip} labelFormatter={(d) => fmtDate(String(d), true)} formatter={((v: number, n: string) => [`${nf(v)} m³/s`, n]) as never} />
          <ReferenceLine x={today} stroke="#e8eef1" strokeDasharray="4 4" label={{ value: "today", fill: "#93a9b4", fontSize: 11 }} />
          <Line dataKey="p90" name="90th percentile, past years" stroke="#e9a93b" strokeDasharray="5 4" dot={false} strokeWidth={1.5} />
          <Line dataKey="p50" name="median, past years" stroke="#6c8591" dot={false} strokeWidth={1.5} />
          <Line dataKey="q" name="GloFAS discharge" stroke="#57b8c9" dot={false} strokeWidth={2.4} />
        </LineChart>
      </ResponsiveContainer>
      {o.basin_rain.median_mm !== null && (
        <p className="note">Basin rain, next {o.basin_rain.days} days (GFS): median {o.basin_rain.median_mm} mm over {o.basin_rain.points.length} points, wettest {o.basin_rain.wettest} ({o.basin_rain.max_mm} mm).</p>
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
  const [scen, setScen] = useState<"auto" | "river_rising" | "river_not_rising">("auto");
  const active = scen === "auto" ? (pri?.scenario as "river_rising" | "river_not_rising" | undefined) ?? "river_not_rising" : scen;
  const rows = useMemo(() => {
    if (!hz) return [];
    const exp = new Map((ex?.stretches ?? []).map((e) => [e.id, e]));
    const pr = new Map((pri?.stretches ?? []).map((e) => [e.id, e]));
    return hz.stretches.filter((s) => s.scenarios).map((s) => ({
      id: s.id, level: s.level as Level, p: s.scenarios![active].p, other: s.scenarios![active === "river_rising" ? "river_not_rising" : "river_rising"].p,
      driver: s.scenarios![active].drivers[0], exp: exp.get(s.id), pri: pr.get(s.id),
    })).sort((a, b) => b.p - a.p || (a.id < b.id ? -1 : 1));
  }, [hz, ex, pri, active]);
  if (error) return <ErrorBox error={error} />;
  if (!data || !hz) return <Loading what="the forecast" />;
  const bt = hz.backtest;
  const g = bt.models[hz.model];
  const gNo = hz.backtest_without_outlook.models[hz.model];
  const testDates = bt.tested_passes.map((k) => data.manifest.passes[k + 1]?.date).filter(Boolean) as string[];
  const likely = rows.filter((r) => r.p >= 0.5).length;

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <h2>Which stretches move next</h2>
            <p>A machine-learning model, trained on the bank movements NISAR measured this monsoon, gives each stretch a probability of moving at least 30 m inland by the next pass. A daily river forecast says whether the next pass comes on a rising river. Both are forecasts, labelled as such.</p>
          </div>
          <div className="seg" role="group" aria-label="River scenario">
            {(["auto", "river_rising", "river_not_rising"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={scen === s} onClick={() => setScen(s)}>
                {s === "auto" ? `From outlook${pri ? ` (${pri.scenario === "river_rising" ? "rising" : "not rising"})` : ""}` : s === "river_rising" ? "River rising" : "River not rising"}
              </button>
            ))}
          </div>
        </div>

        <section className="grid g-4">
          <Kpi label="Likely to move next pass" value={likely} unit={`of ${rows.length}`} accent="var(--erosion)" foot={<>Probability ≥ 50%, scenario: {active === "river_rising" ? "river rising" : "river not rising"}</>} />
          <Kpi label="Model back-test (Brier)" value={g.brier} accent="var(--monsoon)" foot={<>Lower is better · base rate {bt.models.base_rate?.brier} · trend {bt.models.trend?.brier}</>} />
          <Kpi label="Ranking skill (AUC)" value={g.auc ?? "–"} accent="var(--watch)" foot={<>0.5 = coin flip · {g.n} held-out checks on {testDates.length} passes</>} />
          <Kpi label="People in the 36-day zone" value={ex ? nf(ex.totals.people_in_high_zone_est) : "–"} accent="var(--home)" foot={<>{ex ? nf(ex.totals.homes_in_high_zone) : "–"} homes × {ex?.household_size} people (Census 2022)</>} />
        </section>

        <section className="grid g-2" style={{ marginTop: 16 }}>
          <OutlookCard o={ol} />
          <div className="card">
            <h3>How the model was tested</h3>
            <p className="sub">Rolling back-test: to score a pass, the model only saw labels known before it. Scored passes: {testDates.map((d) => fmtDate(d)).join(", ")}.</p>
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Model</th><th>Brier ↓</th><th>AUC ↑</th><th>Precision</th><th>Recall</th></tr></thead>
                <tbody>
                  {Object.entries(bt.models).sort((a, b) => a[1].brier - b[1].brier).map(([k, m]) => (
                    <tr key={k} aria-selected={k === hz.model}><td>{MODEL_NAMES[k] ?? k}{k === hz.model && " · shipped"}</td><td className="num">{m.brier}</td>
                      <td className="num">{m.auc ?? "–"}</td><td className="num">{m.precision ?? "–"}</td><td className="num">{m.recall ?? "–"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="note">Without the river-outlook feature the same model scores Brier {gNo.brier}, AUC {gNo.auc ?? "–"}. {hz.learned_beats_baselines ? "The learned model beats every baseline." : "A baseline did as well as the learned models; treat the ranking with care."}</p>
            <p className="note warn">Small sample: {hz.n_rows} labelled rows from one monsoon, on stretches chosen because they moved. Part of the measured movement follows the waterline. Details in docs/MODEL_CARD.md.</p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }}>
          <h3>Stretches by probability</h3>
          <p className="sub">From the last processed pass ({fmtDate(hz.from_pass, true)}). &ldquo;Top driver&rdquo; is the feature that changes this prediction most when set to its typical value.</p>
          <div className="table-wrap" style={{ maxHeight: "60dvh" }}>
            <table className="data">
              <thead><tr><th>Stretch</th><th>Level now</th><th>P(move ≥ 30 m)</th><th>Other scenario</th><th>Top driver</th><th>People in 36-day zone</th><th>Action</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="num">{r.id}</td><td><LevelPill level={r.level} /></td>
                    <td className="num"><b>{pct(r.p)}</b></td><td className="num dim">{pct(r.other)}</td>
                    <td>{r.driver ? <>{r.driver.label} <span className="dim">({r.driver.effect > 0 ? "+" : ""}{Math.round(r.driver.effect * 100)} pts)</span></> : "–"}</td>
                    <td className="num">{r.exp ? nf(r.exp.people_in_high_zone_est) : "–"}</td>
                    <td>{r.pri && <span className={`pill ${r.pri.priority === "act now" ? "red" : r.pri.priority === "watch" ? "amber" : "grey"}`}>{r.pri.priority}{r.pri.escalated ? " ↑" : ""}</span>}</td>
                    <td><Link href={`/map/?seg=${r.id}`}>Map →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="note">&ldquo;↑&rdquo; marks a watch stretch escalated because the river outlook is rising or high. People are homes × average household size, a planning estimate.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
