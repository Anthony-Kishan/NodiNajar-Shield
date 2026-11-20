"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "@/components/Bits";
import { Footer } from "@/components/Shell";
import { Bar, People, PersonGlyph, RibbonLegend, Ring, RiverRibbon, probColor } from "@/components/Visuals";
import { useRiver } from "@/lib/data";
import { useJson } from "@/lib/extra";
import { latStr, nf } from "@/lib/format";
import { pct, plan, type ExposureFile, type HazardFile, type PrioritiesFile } from "@/lib/shield";

function Stepper({ value, set, step, min, max, label }: { value: number; set: (v: number) => void; step: number; min: number; max: number; label: string }) {
  return (
    <div className="stepper">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => set(Math.max(min, value - step))}>−</button>
      <span className="val num">{nf(value)}</span>
      <button type="button" aria-label={`More ${label}`} onClick={() => set(Math.min(max, value + step))}>+</button>
    </div>
  );
}

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
  const marks = useMemo(() => new Map(result.actions.map((a) => [a.id, a.action])), [result]);
  const people = useMemo(() => new Map((ex?.stretches ?? []).map((e) => [e.id, e.people_in_high_zone_est || e.people_est])), [ex]);

  if (error) return <ErrorBox error={error} />;
  if (!data || !hz || !ex) return <Loading what="the response plan" />;
  const segs = data.segments.features.map((f) => f.properties);
  const seg = new Map(segs.map((s) => [s.id, s]));
  const exp = new Map(ex.stretches.map((x) => [x.id, x]));
  const prob = new Map(input.map((x) => [x.id, x.p]));
  const share = result.share_covered ?? 0;
  const crewActs = result.actions.filter((a) => a.action === "geobags");
  const evacActs = result.actions.filter((a) => a.action === "evacuate");

  return (
    <>
      <main className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Response planner</div>
            <h2>Put limited help where it protects the most people</h2>
            <p>Tell NodiNajar what you have this week. It sends each crew and shelter place to where the chance of the bank moving × the people in the way is highest.</p>
          </div>
          <div className="seg" role="group" aria-label="River scenario">
            <button type="button" aria-pressed={rising === null} onClick={() => setRising(null)}>Today&apos;s river</button>
            <button type="button" aria-pressed={rising === true} onClick={() => setRising(true)}>If it rises</button>
            <button type="button" aria-pressed={rising === false} onClick={() => setRising(false)}>If it doesn&apos;t</button>
          </div>
        </div>

        <section className="grid g-3">
          <div className="card">
            <h3>What you have</h3>
            <p className="sub">Planning inputs you set. Nothing here is measured.</p>
            <div className="res-block">
              <div className="res-label"><span className="lvl-dot red" /> Geobag crews <span className="dim" style={{ fontWeight: 500 }}>· one 500 m stretch each</span></div>
              <Stepper value={crews} set={setCrews} step={1} min={0} max={20} label="crews" />
              <input type="range" min={0} max={20} value={crews} onChange={(e) => setCrews(Number(e.target.value))} aria-label="Geobag crews" style={{ marginTop: 10 }} />
            </div>
            <div className="res-block">
              <div className="res-label"><span className="lvl-dot" style={{ background: "#7356d0" }} /> Shelter places</div>
              <Stepper value={shelter} set={setShelter} step={50} min={0} max={3000} label="shelter places" />
              <input type="range" min={0} max={3000} step={50} value={shelter} onChange={(e) => setShelter(Number(e.target.value))} aria-label="Shelter places" style={{ marginTop: 10 }} />
            </div>
          </div>

          <div className="card tint-people span-2" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 26, alignItems: "center" }}>
            <Ring value={share} total={1} size={190} stroke={18} color="#7356d0" label={<><b style={{ fontSize: 40 }}>{pct(share)}</b><span>of people at risk<br />covered</span></>} />
            <div>
              <h3 style={{ fontSize: 24 }}>This plan reaches {pct(share)} of the expected people at risk</h3>
              <p className="muted" style={{ margin: "4px 0 14px" }}>{nf(result.expected_people_covered, 0)} of {nf(result.expected_people_total, 0)} people the model expects to be hit, weighted by chance.</p>
              <People n={30} filled={Math.round(share * 30)} />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                <span className="pill red">{crewActs.length} geobag crews placed</span>
                <span className="pill violet">{nf(evacActs.reduce((a, x) => a + (x.places ?? 0), 0))} people to shelter</span>
                <span className="pill grey">{nf(result.shelter_unused)} places spare</span>
              </div>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 18 }}>
          <div className="card-head"><div><h3>Where the help goes</h3><p className="sub">Solid ring: geobag crew. Dashed ring: evacuation. Dot colour: chance of moving.</p></div></div>
          <div className="ribbon-wrap light">
            <RiverRibbon banklines={data.banklines} segs={segs.filter((s) => prob.has(s.id))} bbox={data.manifest.aoi_bbox} prob={prob} people={people} marks={marks}
              onPick={(id) => (window.location.href = `/alerts/?seg=${id}`)} />
            <RibbonLegend mode="plan" />
          </div>
        </section>

        <section style={{ marginTop: 18 }}>
          <h3 style={{ fontFamily: "var(--display)", fontSize: 22, margin: "0 0 12px" }}>The plan, step by step</h3>
          {result.actions.length === 0 ? <div className="card muted">Add crews or shelter places to see a plan.</div> : (
            <div className="act-grid">
              {result.actions.map((a, i) => {
                const s = seg.get(a.id), e = exp.get(a.id), p = prob.get(a.id) ?? 0;
                const geo = a.action === "geobags";
                return (
                  <Link key={a.id} href={`/alerts/?seg=${a.id}`} className="act-card" style={{ ["--accent" as string]: geo ? "#cf4a2f" : "#7356d0" }}>
                    <div className="act-top"><span className="act-num">#{i + 1}</span><span className={`pill ${geo ? "red" : "violet"}`}>{geo ? "Geobag crew" : `Shelter ${nf(a.places ?? 0)}`}</span></div>
                    <h4>{a.id}</h4>
                    <div className="act-meta">{s ? `${s.side === "west" ? "West" : "East"} bank · ${latStr(s.centre[1])}` : ""}{e?.nearest_home_m != null && ` · nearest home ${e.nearest_home_m} m`}</div>
                    <div style={{ marginTop: 10 }}><Bar value={p} color={probColor(p)} /></div>
                    <div className="act-foot">
                      <div className="big">{pct(p)}<small>chance of moving</small></div>
                      <div className="big" style={{ textAlign: "right", color: "#7356d0" }}><PersonGlyph /> {e ? nf(e.people_in_high_zone_est) : "–"}<small>people in the way</small></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <p className="note warn" style={{ marginTop: 16 }}>People = homes × {ex.household_size} (Census 2022 household size). Chances come from a model tested on one monsoon. Tap a card for its alert.</p>
        </section>
      </main>
      <Footer />
    </>
  );
}
