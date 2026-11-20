"use client";
import Link from "next/link";
import { useJson } from "@/lib/extra";
import { nf } from "@/lib/format";
import { MODEL_NAMES, plan, type ExposureFile, type HazardFile, type OutlookFile, type PrioritiesFile } from "@/lib/shield";

/** Overview strip: what the early-warning layer adds on top of the radar measurements. */
export function ShieldCard() {
  const hz = useJson<HazardFile>("hazard.json");
  const ex = useJson<ExposureFile>("exposure.json");
  const pri = useJson<PrioritiesFile>("priorities.json");
  const ol = useJson<OutlookFile>("outlook.json");
  if (!hz || !ex || !pri) return null;
  const likely = pri.stretches.filter((s) => s.p >= 0.5).length;
  const act = pri.stretches.filter((s) => s.priority === "act now").length;
  const p5 = plan(pri.stretches, 5, 500);
  const m = hz.backtest.models[hz.model];
  return (
    <div className="card" style={{ borderColor: "var(--monsoon-2)" }}>
      <div className="card-head">
        <div>
          <h3>Early warning: what happens next</h3>
          <p className="sub">ML forecast ({MODEL_NAMES[hz.model] ?? hz.model}, back-test AUC {m.auc ?? "–"}), river outlook and the people in the way.</p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link className="btn sm primary" href="/forecast/">Forecast</Link>
          <Link className="btn sm" href="/plan/">Response plan</Link>
          <Link className="btn sm" href="/assistant/">Ask NodiNajar</Link>
        </div>
      </div>
      <div className="grid g-4" style={{ marginTop: 6 }}>
        <div><div className="dim" style={{ fontSize: 12.5 }}>Likely to move next pass</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{likely}</div></div>
        <div><div className="dim" style={{ fontSize: 12.5 }}>Stretches to act on now</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{act}</div></div>
        <div><div className="dim" style={{ fontSize: 12.5 }}>People in the 36-day zone (est.)</div><div className="num" style={{ fontSize: 26, fontWeight: 700 }}>{nf(ex.totals.people_in_high_zone_est)}</div></div>
        <div><div className="dim" style={{ fontSize: 12.5 }}>River, next 7 days</div><div style={{ fontSize: 20, fontWeight: 700 }}>{ol ? `${ol.river.trend} · ${ol.river.band}` : "outlook not fetched"}</div></div>
      </div>
      <p className="note">With 5 crews and 500 shelter places, the planner covers {nf(p5.expected_people_covered, 1)} of {nf(p5.expected_people_total, 1)} expected people at risk. Forecasts and people counts are estimates; radar measurements are provisional.</p>
    </div>
  );
}
