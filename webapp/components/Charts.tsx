"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceArea, ReferenceLine,
  ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { fmtDate, parseDate } from "@/lib/format";
import { ErrorBar } from "recharts";
import type { Level, Pass, SegmentProps } from "@/lib/types";

const C = { grid: "#ebe4d7", axis: "#7d8b8e", water: "#0f7c8c", red: "#cf4a2f", amber: "#d0901c", green: "#3b8a5f", home: "#7356d0" };
const LEVEL_C: Record<Level, string> = { red: C.red, amber: C.amber, green: C.green };
const tip = { contentStyle: { background: "#ffffff", border: "1px solid #e7e0d3", borderRadius: 14, color: "#15282e", fontSize: 12.5, boxShadow: "0 12px 32px rgba(21,40,46,.12)" },
  labelStyle: { color: "#5d6e72", fontWeight: 600 }, itemStyle: { color: "#15282e" }, cursor: { stroke: "#d9cfbd" } };
const axis = { stroke: C.axis, tick: { fill: C.axis, fontSize: 11.5 }, tickLine: false, axisLine: { stroke: C.grid } };

/** Water in the box on each pass, by real date, with missing passes shaded. */
export function WaterChart({ passes, gaps, selected, height = 230 }: { passes: Pass[]; gaps: { from: string; to: string }[]; selected?: number; height?: number }) {
  const rows = passes.map((p) => ({ t: parseDate(p.date).getTime(), km2: p.water_km2, date: p.date }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={rows} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
        <defs>
          <linearGradient id="wfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.water} stopOpacity={0.55} />
            <stop offset="100%" stopColor={C.water} stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
        {gaps.map((g) => (
          <ReferenceArea key={g.from} x1={parseDate(g.from).getTime()} x2={parseDate(g.to).getTime()} fill="#93a9b4" fillOpacity={0.07}
            label={{ value: "no pass", fill: "#6c8591", fontSize: 11, position: "insideTop" }} />
        ))}
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} {...axis}
          tickFormatter={(t) => fmtDate(new Date(t))} ticks={rows.map((r) => r.t)} interval="preserveStartEnd" />
        <YAxis {...axis} width={48} tickFormatter={(v) => `${v}`} unit="" />
        <Tooltip {...tip} labelFormatter={(t) => fmtDate(new Date(Number(t)), true)} formatter={((v: number) => [`${v.toFixed(1)} km²`, "Water in box"]) as never} />
        {selected !== undefined && <ReferenceLine x={rows[selected]?.t} stroke="#15282e" strokeDasharray="4 4" />}
        <Area type="linear" dataKey="km2" stroke={C.water} strokeWidth={2.4} fill="url(#wfill)" isAnimationActive
          dot={{ r: 3.5, fill: C.water, stroke: "#ffffff", strokeWidth: 1.5 }} activeDot={{ r: 6 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Bank position on each pass, metres into the land since the first pass. Missing passes break the line. */
export function RetreatChart({ dates, history, level, height = 200 }: { dates: string[]; history: (number | null)[]; level: Level; height?: number }) {
  const rows = dates.map((d, i) => ({ t: parseDate(d).getTime(), m: history[i] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} {...axis} tickFormatter={(t) => fmtDate(new Date(t))}
          ticks={[rows[0].t, rows[Math.floor(rows.length / 2)].t, rows[rows.length - 1].t]} />
        <YAxis {...axis} width={46} unit=" m" />
        <ReferenceLine y={0} stroke="#d9cfbd" />
        <Tooltip {...tip} labelFormatter={(t) => fmtDate(new Date(Number(t)), true)}
          formatter={((v: number | null) => [v === null ? "bank not measured" : `${v} m`, "Bank moved"]) as never} />
        <Line type="linear" dataKey="m" stroke={LEVEL_C[level]} strokeWidth={2.6} connectNulls={false}
          dot={{ r: 3.5, fill: LEVEL_C[level], stroke: "#ffffff" }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Every measured stretch along the river: latitude (south to north) against retreat; bubble size = homes near. */
export function RiverProfile({ segs, onPick, height = 260 }: { segs: SegmentProps[]; onPick?: (id: string) => void; height?: number }) {
  const rows = segs.map((s) => ({ lat: s.centre[1], m: s.retreat_m, homes: Math.max(1, s.homes_near), id: s.id, level: s.level, side: s.side }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 0 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" />
        <XAxis dataKey="lat" type="number" domain={["dataMin - 0.02", "dataMax + 0.02"]} {...axis} tickFormatter={(v) => `${v.toFixed(2)}°N`} name="Latitude" />
        <YAxis dataKey="m" type="number" {...axis} width={50} unit=" m" name="Retreat" />
        <ZAxis dataKey="homes" range={[40, 520]} name="Homes" />
        <ReferenceLine y={100} stroke={C.red} strokeDasharray="5 5" label={{ value: "100 m", fill: "#cf4a2f", fontSize: 11, position: "right" }} />
        <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }}
          formatter={((v: number, n: string) => (n === "Latitude" ? [`${v.toFixed(3)}° N`, n] : n === "Retreat" ? [`${v} m`, n] : [v, "Homes within 200 m"])) as never} />
        <Scatter data={rows} onClick={((d: { id?: string }) => d?.id && onPick?.(d.id)) as never} cursor="pointer">
          {rows.map((r) => <Cell key={r.id} fill={LEVEL_C[r.level]} fillOpacity={0.8} stroke="#ffffff" />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Stretches by risk level on each bank. */
export function LevelBars({ segs, height = 200 }: { segs: SegmentProps[]; height?: number }) {
  const rows = (["west", "east"] as const).map((side) => ({
    side: side === "west" ? "West bank" : "East bank",
    red: segs.filter((s) => s.side === side && s.level === "red").length,
    amber: segs.filter((s) => s.side === side && s.level === "amber").length,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 10, bottom: 0 }} barSize={22}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" horizontal={false} />
        <XAxis type="number" {...axis} allowDecimals={false} />
        <YAxis type="category" dataKey="side" {...axis} width={78} />
        <Tooltip {...tip} cursor={{ fill: "rgba(87,184,201,.06)" }} />
        <Bar dataKey="red" stackId="a" name="High risk" fill={C.red} radius={[4, 0, 0, 4]} />
        <Bar dataKey="amber" stackId="a" name="Watch" fill={C.amber} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Forecast check: measured bank position (x) against the forecast (y), with the forecast range as an error bar. */
export function ForecastCheckChart({ rows, height = 300 }: { rows: { id: string; date: string; measured: number; expected: number; low: number; high: number }[]; height?: number }) {
  const data = rows.map((r) => ({ ...r, err: [r.expected - r.low, r.high - r.expected] }));
  // axes fit the forecasts and measurements; very wide ranges are clipped at the edge
  const vals = rows.flatMap((r) => [r.measured, r.expected]);
  const lo = Math.floor(Math.min(0, ...vals) / 50) * 50, hi = Math.ceil(Math.max(...vals) / 50) * 50 + 50;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 10, right: 16, left: -6, bottom: 6 }}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" />
        <XAxis dataKey="measured" type="number" domain={[lo, hi]} allowDataOverflow {...axis} unit=" m" name="Measured"
          label={{ value: "measured by NISAR", fill: C.axis, fontSize: 11.5, position: "insideBottomRight", offset: -2 }} />
        <YAxis dataKey="expected" type="number" domain={[lo, hi]} allowDataOverflow {...axis} width={56} unit=" m" name="Forecast"
          label={{ value: "forecast", fill: C.axis, fontSize: 11.5, angle: -90, position: "insideLeft", offset: 14 }} />
        <ReferenceLine segment={[{ x: lo, y: lo }, { x: hi, y: hi }]} stroke="#93a9b4" strokeDasharray="5 5" ifOverflow="hidden" />
        <Tooltip {...tip} cursor={{ strokeDasharray: "3 3" }}
          content={({ payload }) => {
            const d = payload?.[0]?.payload as (typeof data)[number] | undefined;
            if (!d) return null;
            return (
              <div style={{ ...tip.contentStyle, padding: "8px 10px" }}>
                <b>{d.id}</b> · {fmtDate(d.date, true)}<br />
                forecast {d.expected} m ({d.low}–{d.high})<br />measured <b>{d.measured} m</b>
              </div>
            );
          }} />
        <Scatter data={data} fill={C.water} stroke="#ffffff" strokeWidth={1.5}>
          <ErrorBar dataKey="err" direction="y" width={0} stroke="#0f7c8c" strokeOpacity={0.45} />
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

/** Daily rain (NASA POWER) with the NISAR pass dates marked. */
export function RainChart({ daily, passDates, height = 220 }: { daily: { date: string; mm: number }[]; passDates: string[]; height?: number }) {
  const rows = daily.map((d) => ({ t: parseDate(d.date).getTime(), mm: d.mm }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 10, right: 12, left: -6, bottom: 0 }} barCategoryGap={1}>
        <CartesianGrid stroke={C.grid} strokeDasharray="3 4" vertical={false} />
        <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} {...axis}
          tickFormatter={(t) => fmtDate(new Date(t))} ticks={passDates.map((d) => parseDate(d).getTime())} />
        <YAxis {...axis} width={48} unit="" />
        <Tooltip {...tip} cursor={{ fill: "rgba(87,184,201,.08)" }} labelFormatter={(t) => fmtDate(new Date(Number(t)), true)}
          formatter={((v: number) => [`${v} mm`, "Rain that day"]) as never} />
        {passDates.map((d) => <ReferenceLine key={d} x={parseDate(d).getTime()} stroke="#15282e" strokeOpacity={0.35} strokeDasharray="3 3" />)}
        <Bar dataKey="mm" fill="#5b8fd0" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
