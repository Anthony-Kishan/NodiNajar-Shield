"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorBox, Kpi, Loading } from "@/components/Bits";
import { Footer } from "@/components/Shell";
import { useRiver } from "@/lib/data";
import { useJson } from "@/lib/extra";
import { latStr, nf } from "@/lib/format";
import { pct, plan, type ExposureFile, type HazardFile, type PrioritiesFile } from "@/lib/shield";

export default function PlanPage() {
  const { data, error } = useRiver();
  const hz = useJson<HazardFile>("hazard.json");
  const ex = useJson<ExposureFile>("exposure.json");
  const pri = useJson<PrioritiesFile>("priorities.json");
  const [crews, setCrews] = useState(5);
  const [shelter, setShelter] = useState(500);
  const [rising, setRising] = useState<boolean | null>(null);
  const scen = rising === null ? (pri?.scenario ?? "river_not_rising") : rising ? "river_rising" : "river_not_rising";

  const input = useMemo(() => {
    if (!hz || !ex) return [];
    const e = new Map(ex.stretches.map((x) => [x.id, x]));
    return hz.stretches.filter((s) => s.scenarios && e.has(s.id)).map((s) => ({
      id: s.id, p: s.scenarios![scen as "river_rising" | "river_not_rising"].p,
      people_est: e.get(s.id)!.people_est, people_in_high_zone_est: e.get(s.id)!.people_in_high_zone_est,
    }));
  }, [hz, ex, scen]);
  const result = useMemo(() => plan(input, crews, shelter), [input, crews, shelter]);

  if (error) return <ErrorBox error={error} />;
  if (!data || !hz || !ex) return <Loading what="the response plan" />;
  const seg = new Map(data.segments.features.map((f) => [f.properties.id, f.properties]));
  const exp = new Map(ex.stretches.map((x) => [x.id, x]));
  const prob = new Map(input.map((x) => [x.id, x.p]));

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <h2>Response plan: protect the most people</h2>
            <p>Set how many emergency crews (each can place geobags on one 500 m stretch) and shelter places you have this week. The planner puts them where the expected number of people protected is highest: probability of the bank moving × people in the forecast loss zone.</p>
          </div>
          <div className="seg" role="group" aria-label="River scenario">
            <button type="button" aria-pressed={rising === null} onClick={() => setRising(null)}>From outlook</button>
            <button type="button" aria-pressed={rising === true} onClick={() => setRising(true)}>River rising</button>
            <button type="button" aria-pressed={rising === false} onClick={() => setRising(false)}>Not rising</button>
          </div>
        </div>

        <section className="grid g-4">
          <Kpi label="People near the moving banks" value={nf(ex.totals.people_est)} accent="var(--home)" foot={<>{nf(ex.totals.homes)} homes within 200 m of the new bank</>} />
          <Kpi label="People in the 36-day zone" value={nf(ex.totals.people_in_high_zone_est)} accent="var(--erosion)" foot={<>Homes the high-end forecast reaches by {ex.horizon ?? "the third pass"}</>} />
          <Kpi label="Expected people covered" value={nf(result.expected_people_covered, 1)} unit={`of ${nf(result.expected_people_total, 1)}`} accent="var(--ok)" foot={<>{result.share_covered === null ? "–" : pct(result.share_covered)} of the expected total with this plan</>} />
          <Kpi label="Shelter places left" value={nf(result.shelter_unused)} accent="var(--monsoon)" foot={<>Of {nf(shelter)} available</>} />
        </section>

        <section className="grid g-3" style={{ marginTop: 16 }}>
          <div className="card">
            <h3>Resources this week</h3>
            <p className="sub">Planning inputs, set by the user. Nothing here is measured.</p>
            <label className="ctrl-title" htmlFor="crews">Geobag crews: <b className="num">{crews}</b></label>
            <input id="crews" type="range" min={0} max={20} step={1} value={crews} onChange={(e) => setCrews(Number(e.target.value))} style={{ width: "100%" }} />
            <label className="ctrl-title" htmlFor="shelter">Shelter places: <b className="num">{nf(shelter)}</b></label>
            <input id="shelter" type="range" min={0} max={3000} step={50} value={shelter} onChange={(e) => setShelter(Number(e.target.value))} style={{ width: "100%" }} />
            <p className="note">Crews go to the stretches with the most expected people first. Shelter places then go to the stretches without a crew, up to the number of people in their forecast zone.</p>
            <p className="note warn">People = homes × {ex.household_size} ({ex.household_source}). Probabilities come from a model tested on one monsoon (see Forecast).</p>
          </div>
          <div className="card span-2">
            <h3>The plan</h3>
            <p className="sub">Scenario: {scen === "river_rising" ? "river rising" : "river not rising"} · {result.actions.length} actions</p>
            {result.actions.length === 0 ? <p className="muted">Add crews or shelter places to see a plan.</p> : (
              <div className="table-wrap" style={{ maxHeight: "58dvh" }}>
                <table className="data">
                  <thead><tr><th>#</th><th>Stretch</th><th>Action</th><th>P(move)</th><th>People in zone</th><th>Expected people</th><th>Nearest home</th><th /></tr></thead>
                  <tbody>
                    {result.actions.map((a, i) => {
                      const s = seg.get(a.id), e = exp.get(a.id);
                      return (
                        <tr key={a.id}>
                          <td className="num">{i + 1}</td>
                          <td>{a.id} <span className="dim">{s ? `${s.side} bank, ${latStr(s.centre[1])}` : ""}</span></td>
                          <td><span className={`pill ${a.action === "geobags" ? "red" : "amber"}`}>{a.action === "geobags" ? "Geobag crew" : `Evacuate ${nf(a.places ?? 0)}`}</span></td>
                          <td className="num">{pct(prob.get(a.id) ?? 0)}</td>
                          <td className="num">{e ? nf(e.people_in_high_zone_est) : "–"}</td>
                          <td className="num"><b>{nf(a.expected_people, 1)}</b></td>
                          <td className="num">{e?.nearest_home_m != null ? `${e.nearest_home_m} m` : "–"}</td>
                          <td><Link href={`/alerts/?seg=${a.id}`}>Alert →</Link></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
