"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ErrorBox, Loading } from "@/components/Bits";
import { WaterChart } from "@/components/Charts";
import { RiverMap } from "@/components/MapClient";
import { NasaDataCard } from "@/components/NasaData";
import { Footer } from "@/components/Shell";
import { Bar, Dial, MapBoundary, People, RibbonLegend, Ring, RiverRibbon, probColor } from "@/components/Visuals";
import { useRiver } from "@/lib/data";
import { useJson } from "@/lib/extra";
import { fmtDate, nf } from "@/lib/format";
import { DEFAULT_LAYERS } from "@/lib/mapLayers";
import { gaps } from "@/lib/schedule";
import { pct, plan, type ExposureFile, type HazardFile, type OutlookFile, type PrioritiesFile } from "@/lib/shield";

const TREND_ICON: Record<string, string> = { rising: "↗", falling: "↘", steady: "→", unknown: "·" };

export default function Overview() {
  const { data, error } = useRiver();
  const hz = useJson<HazardFile>("hazard.json");
  const ex = useJson<ExposureFile>("exposure.json");
  const pri = useJson<PrioritiesFile>("priorities.json");
  const ol = useJson<OutlookFile>("outlook.json");
  const [sel, setSel] = useState<string | null>(null);
  const segs = useMemo(() => data?.segments.features.map((f) => f.properties) ?? [], [data]);
  const people = useMemo(() => new Map((ex?.stretches ?? []).map((e) => [e.id, e.people_in_high_zone_est || e.people_est])), [ex]);

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const m = data.manifest, t = m.totals, P = m.passes;
  const first = P[0], last = P[P.length - 1];
  const moving = t.cells_red + t.cells_amber;
  const zone = ex?.totals.people_in_high_zone_est;
  const likely = pri ? pri.stretches.filter((s) => s.p >= 0.5).length : null;
  const plan5 = pri ? plan(pri.stretches, 5, 500) : null;
  const top = pri
    ? [...pri.stretches].sort((a, b) => Number(b.priority === "act now") - Number(a.priority === "act now") || b.p * (b.people_in_high_zone_est || 1) - a.p * (a.people_in_high_zone_est || 1)).slice(0, 5)
    : [];
  const segById = new Map(segs.map((s) => [s.id, s]));
  const g = ol?.gauges[0];

  return (
    <>
      <main className="page">
        {/* ---------------- hero ---------------- */}
        <section className="card hero">
          <div className="eyebrow">● NISAR L-band radar · {P.length} passes · {fmtDate(first.date)} – {fmtDate(last.date, true)}</div>
          <h2>The Jamuna is eating into <em>{moving} stretches</em> of its banks{zone !== undefined && <>. <em>{nf(zone)} people</em> live where it could reach next</>}.</h2>
          <p className="lede">Radar sees through monsoon cloud. AI forecasts which bank goes next. Officials get a plan and an alert before the land is gone.</p>
          <div className="hero-stats">
            <div className="hero-stat clay"><b>{t.cells_red}</b><span>high-risk stretches</span></div>
            <div className="hero-stat gold"><b>{nf(t.land_lost_ha, 0)} ha</b><span>land taken this monsoon</span></div>
            <div className="hero-stat"><b>{t.max_retreat_m} m</b><span>largest bank movement</span></div>
            <div className="hero-stat lilac"><b>{nf(t.homes_near_new_bank)}</b><span>homes near the new bank</span></div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Link className="btn primary" href="/forecast/">See the forecast →</Link>
              <Link className="btn" href="/map/">Open the map</Link>
            </div>
          </div>
          <div className="ribbon-wrap">
            <RiverRibbon banklines={data.banklines} segs={segs} bbox={m.aoi_bbox} people={people} selected={sel}
              onPick={(id) => setSel(id === sel ? null : id)} dark />
            <RibbonLegend mode="level" dark />
            <div className="ribbon-hint" style={{ color: "#cfe" }}>← swipe to see the whole river →</div>
          </div>
        </section>

        {/* ---------------- three visual answers ---------------- */}
        <section className="grid g-3" style={{ marginTop: 18 }}>
          <div className="card tint-clay lift">
            <div className="card-head"><div><h3>Act first</h3><p className="sub">Highest priority this week</p></div><Link className="btn sm" href="/plan/">Plan →</Link></div>
            <div className="prob-list">
              {top.map((p, i) => {
                const s = segById.get(p.id);
                return (
                  <Link key={p.id} href={`/map/?seg=${p.id}`} className="prob-row" style={{ gridTemplateColumns: "26px 1fr 56px", background: "rgba(255,255,255,.75)" }}>
                    <span className={`rank ${p.level}`}>{i + 1}</span>
                    <span>
                      <b>{p.id}</b> <span className="muted" style={{ fontSize: 12.5 }}>{s?.side === "west" ? "West" : "East"} bank · {nf(p.people_in_high_zone_est)} people</span>
                      <div style={{ marginTop: 6 }}><Bar value={p.p} color={probColor(p.p)} /></div>
                    </span>
                    <span className="prob-pct">{pct(p.p)}</span>
                  </Link>
                );
              })}
              {!top.length && <p className="muted">Loading priorities…</p>}
            </div>
          </div>

          <div className="card tint-river lift" style={{ display: "flex", flexDirection: "column" }}>
            <div className="card-head"><div><h3>The river today</h3><p className="sub">{g ? `${g.name} · Copernicus GloFAS` : "Daily river forecast"}</p></div>
              <span className="pill blue">forecast</span></div>
            {g ? (
              <div style={{ display: "grid", placeItems: "center", flex: 1 }}>
                <Dial pct={g.today.pct} />
                <div style={{ textAlign: "center", marginTop: -6 }}>
                  <div style={{ fontFamily: "var(--display)", fontSize: 30, fontWeight: 600, textTransform: "capitalize" }}>{g.today.band} {TREND_ICON[g.trend_7d.trend]}</div>
                  <div className="muted" style={{ fontSize: 13.5 }}>{nf(g.today.q)} m³/s · {g.trend_7d.trend} over the next 7 days{g.trend_7d.change_pct !== null && ` (${g.trend_7d.change_pct > 0 ? "+" : ""}${g.trend_7d.change_pct}%)`}</div>
                </div>
              </div>
            ) : <p className="muted">River outlook not fetched yet.</p>}
          </div>

          <div className="card tint-people lift">
            <div className="card-head"><div><h3>What the AI expects</h3><p className="sub">Next radar pass, after {fmtDate(last.date)}</p></div><span className="pill violet">AI</span></div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <Ring value={likely ?? 0} total={pri?.stretches.length ?? 1} color="#cf4a2f"
                label={<><b>{likely ?? "–"}</b><span>of {pri?.stretches.length ?? "–"} likely<br />to move</span></>} />
              <div style={{ flex: 1 }}>
                <div className="muted" style={{ fontSize: 13 }}>Back-test score</div>
                <div style={{ fontFamily: "var(--display)", fontSize: 26, fontWeight: 600 }}>{hz ? hz.backtest.models[hz.model].auc : "–"} <span className="muted" style={{ fontSize: 13, fontFamily: "var(--font)" }}>AUC</span></div>
                <div style={{ marginTop: 6 }}><Bar value={(hz?.backtest.models[hz.model].auc ?? 0.5) - 0.5} max={0.5} color="#7356d0" /></div>
                <div className="dim" style={{ fontSize: 11.5, marginTop: 4 }}>coin flip ← → perfect</div>
              </div>
            </div>
            {plan5 && (
              <div style={{ marginTop: 16 }}>
                <People n={20} filled={Math.round((plan5.share_covered ?? 0) * 20)} />
                <div style={{ fontSize: 13.5, marginTop: 8 }}><b>5 crews + 500 shelter places</b> reach <b>{pct(plan5.share_covered ?? 0)}</b> of the people at risk.</div>
              </div>
            )}
          </div>
        </section>

        {/* ---------------- map + monsoon ---------------- */}
        <section className="grid g-3" style={{ marginTop: 18 }}>
          <div className="card span-2" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "18px 22px 12px" }} className="card-head">
              <div><h3>Satellite view</h3><p className="sub" style={{ margin: 0 }}>The bank on 18 June and today, over satellite imagery</p></div>
              <Link className="btn sm" href={sel ? `/map/?seg=${sel}` : "/map/"}>Full map →</Link>
            </div>
            <div className="map-mini" style={{ borderRadius: 0, border: 0 }}>
              <MapBoundary>
                <RiverMap data={data} passIndex={P.length - 1} basemap="satellite" layers={{ ...DEFAULT_LAYERS, radar: false, firstBank: true }}
                  radarOpacity={0.8} threeD={false} selectedId={sel} onSelect={setSel} compact />
              </MapBoundary>
            </div>
          </div>
          <div className="card">
            <h3>The monsoon, pass by pass</h3>
            <p className="sub">River water in the box (km²). Swelling is flooding, not erosion, and is not counted.</p>
            <WaterChart passes={P} gaps={gaps(m)} height={300} />
          </div>
        </section>

        <section style={{ marginTop: 18 }}><NasaDataCard /></section>
      </main>
      <Footer />
    </>
  );
}
