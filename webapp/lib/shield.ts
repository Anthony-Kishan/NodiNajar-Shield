/**
 * Climate Shield data types and the two rules the browser re-runs live:
 *  - plan(): same rules as src/compute/planner.py (tests/test_planner cases are mirrored in the docs)
 *  - checkGrounding(): same rule as src/agent/grounding.py
 * No numbers are invented here; everything is read from the pipeline JSON files.
 */

export interface Driver { feature: string; label: string; value: number; effect: number }
export interface Scenario { p: number; drivers: Driver[] }
export interface ModelScore { n: number; positives: number; brier: number; precision: number | null; recall: number | null; auc: number | null }
export interface Backtest { tested_passes: number[]; models: Record<string, ModelScore>; best: string; dropped: string[] }
export interface HazardFile {
  label: string; model: string; n_rows: number; base_rate: number; status: string; from_pass: string;
  features: { name: string; label: string }[];
  backtest: Backtest; backtest_without_outlook: Backtest; learned_beats_baselines: boolean;
  stretches: { id: string; level: string; scenarios: { river_rising: Scenario; river_not_rising: Scenario } | null }[];
}
export interface ExposureRow {
  id: string; advance_expected_m: number | null; advance_high_m: number | null; homes: number; people_est: number;
  homes_in_expected_zone: number; homes_in_high_zone: number; people_in_high_zone_est: number;
  nearest_home_m: number | null; assets: Record<string, number>;
}
export interface ExposureFile {
  household_size: number; household_source: string; horizon: string | null; assets_source: string | null;
  stretches: ExposureRow[]; totals: { homes: number; people_est: number; homes_in_high_zone: number; people_in_high_zone_est: number };
}
export interface PriorityRow { id: string; level: string; p: number; priority: string; escalated: boolean; people_est: number; people_in_high_zone_est: number }
export interface PrioritiesFile { scenario: string; scenario_from: string; generated: string; stretches: PriorityRow[] }
export interface OutlookDay { date: string; q: number; q_p25: number | null; q_p75: number | null; clim_p50: number | null; clim_p90: number | null; pct: number | null; band: string; forecast: boolean }
export interface Gauge { name: string; lat: number; lon: number; today: OutlookDay; trend_7d: { trend: string; change_pct: number | null }; peak: { date: string; q: number; band: string; days_ahead: number }; days: OutlookDay[] }
export interface OutlookFile {
  source: string; fetched_utc: string; status: string; gauges: Gauge[];
  river: { trend: string; band: string; gauge: string };
  basin_rain: { days: number; median_mm: number | null; max_mm: number | null; wettest: string | null; points: { name: string; total_mm: number }[] };
}

// ---------------- planner (mirror of src/compute/planner.py) ----------------
export const NEAR_WEIGHT = 0.25;
export interface PlanInput { id: string; p: number; people_est: number; people_in_high_zone_est: number }
export interface PlanAction { id: string; action: "geobags" | "evacuate"; expected_people: number; places?: number }
export interface Plan { crews: number; shelter: number; actions: PlanAction[]; expected_people_covered: number; expected_people_total: number; share_covered: number | null; shelter_unused: number }

const r1 = (x: number) => Math.round(x * 10) / 10;

export function expectedPeople(s: PlanInput): number {
  const zone = s.people_in_high_zone_est || 0;
  const near = s.people_est || 0;
  return s.p * (zone ? zone : NEAR_WEIGHT * near);
}

export function plan(stretches: PlanInput[], crews: number, shelter: number): Plan {
  const ranked = [...stretches].sort((a, b) => expectedPeople(b) - expectedPeople(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const actions: PlanAction[] = [];
  let left = shelter;
  ranked.forEach((s, i) => {
    const ev = expectedPeople(s);
    if (ev <= 0) return;
    if (i < crews) actions.push({ id: s.id, action: "geobags", expected_people: r1(ev) });
    else if (left > 0) {
      const give = Math.min(s.people_in_high_zone_est || 0, left);
      if (give > 0) {
        left -= give;
        actions.push({ id: s.id, action: "evacuate", places: give, expected_people: r1(s.p * give) });
      }
    }
  });
  const covered = actions.reduce((a, x) => a + x.expected_people, 0);
  const total = stretches.reduce((a, s) => a + expectedPeople(s), 0);
  return { crews, shelter, actions, expected_people_covered: r1(covered), expected_people_total: r1(total),
    share_covered: total ? Math.round((covered / total) * 1000) / 1000 : null, shelter_unused: left };
}

// ---------------- grounding (mirror of src/agent/grounding.py) ----------------
const NUM = /(?<![\w.])[-+]?\d[\d,]*(?:\.\d+)?/g;
const toAscii = (s: string) => s.replace(/[০-৯]/g, (d) => String("০১২৩৪৫৬৭৮৯".indexOf(d)));

export function numbersIn(text: string): number[] {
  return (toAscii(text).match(NUM) ?? []).map((m) => Number(m.replace(/,/g, ""))).filter((v) => Number.isFinite(v));
}

export function checkGrounding(answer: string, evidence: string[]): { grounded: boolean; ungrounded: number[] } {
  const ev = new Set<number>();
  for (const e of evidence) for (const v of numbersIn(e)) {
    for (const x of [r1(v), Math.round(v), r1(Math.abs(v)), Math.round(Math.abs(v))]) ev.add(x);
    if (Math.abs(v) > 0 && Math.abs(v) <= 1) { ev.add(r1(100 * Math.abs(v))); ev.add(Math.round(100 * Math.abs(v))); }
  }
  const allowed = (v: number) => (v >= 0 && v <= 12 && Number.isInteger(v)) || (v >= 1900 && v <= 2100 && Number.isInteger(v));
  const bad = [...new Set(numbersIn(answer))].filter((v) => !allowed(v) && !ev.has(r1(v)) && !ev.has(Math.abs(r1(v)))).sort((a, b) => a - b);
  return { grounded: bad.length === 0, ungrounded: bad };
}

export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const MODEL_NAMES: Record<string, string> = {
  gboost: "Gradient-boosted trees", logistic: "Logistic regression", base_rate: "Base rate (no learning)",
  persistence: "Last interval repeats", trend: "Theil-Sen trend",
};
