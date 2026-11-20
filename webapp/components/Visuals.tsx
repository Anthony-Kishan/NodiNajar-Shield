"use client";
/**
 * Visual building blocks: the river ribbon (real NISAR bank lines drawn as a stylised river),
 * ring and dial gauges, probability bars and a people pictogram. Pure SVG: no WebGL needed.
 */
import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import { nf } from "@/lib/format";
import type { Banklines, LngLat, SegmentProps } from "@/lib/types";

// ---------------- colour helpers ----------------
const STOPS: [number, [number, number, number]][] = [
  [0, [15, 124, 140]], [0.35, [94, 163, 140]], [0.55, [208, 144, 28]], [0.75, [222, 106, 54]], [1, [207, 74, 47]],
];
/** Teal (unlikely) → amber → clay (likely). */
export function probColor(p: number): string {
  const x = Math.max(0, Math.min(1, p));
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    const [a, ca] = STOPS[i - 1];
    if (x <= b) {
      const t = (x - a) / (b - a);
      const c = ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  return "rgb(207,74,47)";
}
export const LEVEL_COLOR = { red: "#cf4a2f", amber: "#d0901c", green: "#3b8a5f" } as const;

// ---------------- river ribbon ----------------
type Mark = "geobags" | "evacuate";
export interface RibbonProps {
  banklines: Banklines | null;
  segs: SegmentProps[];
  bbox: [number, number, number, number]; // [west, south, east, north]
  prob?: Map<string, number>;
  people?: Map<string, number>;
  marks?: Map<string, Mark>;
  selected?: string | null;
  onPick?: (id: string) => void;
  dark?: boolean;
  showFirst?: boolean;
}

const W = 1000, PAD = 34;

export function RiverRibbon({ banklines, segs, bbox, prob, people, marks, selected, onPick, dark = false, showFirst = true }: RibbonProps) {
  const [w, s, e, n] = bbox;
  const latSpan = n - s, lonSpan = (e - w) * Math.cos(((s + n) / 2) * Math.PI / 180);
  const H = Math.round((lonSpan / latSpan) * (W - 2 * PAD) + 2 * PAD);
  const X = (lat: number) => PAD + ((lat - s) / latSpan) * (W - 2 * PAD);
  const Y = (lon: number) => PAD + ((lon - w) / (e - w)) * (H - 2 * PAD);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);

  const geo = useMemo(() => {
    if (!banklines) return null;
    const passes = banklines.features.map((f) => f.properties.pass);
    const last = Math.max(...passes), first = Math.min(...passes);
    const path = (coords: LngLat[]) => coords.map(([lon, lat], i) => `${i ? "L" : "M"}${X(lat).toFixed(1)},${Y(lon).toFixed(1)}`).join("");
    const lines = (p: number) => banklines.features.filter((f) => f.properties.pass === p && f.geometry.coordinates.length > 1);
    // river corridor: per latitude bin, westmost west-bank point and eastmost east-bank point of the last pass
    const BINS = 140;
    const wb: (number | null)[] = Array(BINS).fill(null), eb: (number | null)[] = Array(BINS).fill(null);
    for (const f of lines(last)) {
      for (const [lon, lat] of f.geometry.coordinates) {
        const b = Math.min(BINS - 1, Math.max(0, Math.floor(((lat - s) / latSpan) * BINS)));
        if (f.properties.side === "west") wb[b] = wb[b] === null ? lon : Math.min(wb[b]!, lon);
        else eb[b] = eb[b] === null ? lon : Math.max(eb[b]!, lon);
      }
    }
    const fill = (arr: (number | null)[]) => {
      const idx = arr.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0);
      if (!idx.length) return arr;
      return arr.map((v, i) => {
        if (v !== null) return v;
        const lo = [...idx].reverse().find((k) => k < i), hi = idx.find((k) => k > i);
        if (lo === undefined) return arr[hi!]; if (hi === undefined) return arr[lo];
        return arr[lo]! + ((arr[hi]! - arr[lo]!) * (i - lo)) / (hi - lo);
      });
    };
    const W2 = fill(wb), E2 = fill(eb);
    const lat = (i: number) => s + ((i + 0.5) / BINS) * latSpan;
    const top = W2.map((v, i) => (v === null ? null : [X(lat(i)), Y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
    const bot = E2.map((v, i) => (v === null ? null : [X(lat(i)), Y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
    const smooth = (pts: (readonly [number, number])[]) => pts.map((p, i, a) => {
      const q = a.slice(Math.max(0, i - 2), i + 3);
      return [p[0], q.reduce((acc, r) => acc + r[1], 0) / q.length] as const;
    });
    const T = smooth(top), B = smooth(bot);
    const corridor = T.length && B.length
      ? `M${T.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}L${[...B].reverse().map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}Z`
      : "";
    // centre line, drawn north → south so the dash animation flows downstream
    const mid = T.map((p, i) => [p[0], (p[1] + (B[i]?.[1] ?? p[1])) / 2] as const).reverse();
    const flow = mid.length ? `M${mid.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}` : "";
    return {
      corridor, flow,
      lastPaths: lines(last).map((f) => ({ d: path(f.geometry.coordinates), side: f.properties.side })),
      firstPaths: showFirst ? lines(first).map((f) => path(f.geometry.coordinates)) : [],
    };
  }, [banklines, s, n, w, e, H, showFirst]);

  const ink = dark ? "rgba(232,242,241,0.75)" : "#5d6e72";
  const bankStroke = dark ? "#bfeae6" : "#0b5f6b";
  const dots = [...segs].sort((a, b) => (prob?.get(a.id) ?? 0) - (prob?.get(b.id) ?? 0));
  const radius = (sg: SegmentProps) => {
    const ppl = people?.get(sg.id) ?? sg.homes_near * 3.98;
    return Math.min(19, 6 + Math.sqrt(ppl) * 0.75);
  };
  const colorOf = (sg: SegmentProps) => (prob ? probColor(prob.get(sg.id) ?? 0) : LEVEL_COLOR[sg.level]);
  const km10 = (10 / 111.32 / latSpan) * (W - 2 * PAD);
  const town: LngLat = [89.7, 24.45];
  const hv = hover ? segs.find((x) => x.id === hover.id) : null;

  return (
    <div className="ribbon" ref={wrap} style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="The Jamuna from south (left) to north (right), with each moving bank stretch as a dot">
        <defs>
          <linearGradient id="rv-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={dark ? "#3fb3b8" : "#9fd3d5"} stopOpacity={dark ? 0.45 : 0.75} />
            <stop offset="1" stopColor={dark ? "#1b7f8c" : "#cfe9e8"} stopOpacity={dark ? 0.35 : 0.9} />
          </linearGradient>
          <filter id="rv-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        </defs>
        {/* land texture: faint latitude lines */}
        {Array.from({ length: 9 }, (_, i) => s + (i * latSpan) / 8).map((lt) => (
          <line key={lt} x1={X(lt)} x2={X(lt)} y1={PAD - 10} y2={H - PAD + 10} stroke={dark ? "rgba(255,255,255,0.06)" : "#ece5d8"} />
        ))}
        {geo && <path d={geo.corridor} fill="url(#rv-water)" />}
        {geo && <path d={geo.flow} fill="none" stroke={dark ? "rgba(255,255,255,0.55)" : "#ffffff"} strokeWidth={2} className="flow" strokeLinecap="round" />}
        {geo?.firstPaths.map((d, i) => <path key={`f${i}`} d={d} fill="none" stroke={ink} strokeOpacity={0.45} strokeWidth={1} strokeDasharray="3 4" />)}
        {geo?.lastPaths.map((p, i) => <path key={`l${i}`} d={p.d} fill="none" stroke={bankStroke} strokeWidth={1.8} strokeLinejoin="round" />)}

        {/* town marker */}
        <g transform={`translate(${X(town[1])},${Y(town[0])})`}>
          <rect x={-5} y={-5} width={10} height={10} rx={2} fill={dark ? "#ffd38c" : "#15282e"} transform="rotate(45)" />
          <text x={10} y={-10} fontSize={13} fontWeight={700} fill={dark ? "#ffd38c" : "#15282e"}>Sirajganj</text>
        </g>

        {/* stretches */}
        {dots.map((sg) => {
          const cx = X(sg.centre[1]), cy = Y(sg.centre[0]), r = radius(sg), c = colorOf(sg);
          const mk = marks?.get(sg.id);
          const hot = sg.level === "red" || (prob?.get(sg.id) ?? 0) >= 0.5;
          return (
            <g key={sg.id} onMouseEnter={(ev) => {
              const box = wrap.current?.getBoundingClientRect();
              if (box) setHover({ id: sg.id, x: ev.clientX - box.left, y: ev.clientY - box.top });
            }} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(sg.id)}>
              {hot && <circle cx={cx} cy={cy} r={r} fill={c} className="halo" />}
              <circle cx={cx} cy={cy} r={r + 3} fill={c} opacity={0.25} filter="url(#rv-glow)" />
              <circle className="dot" cx={cx} cy={cy} r={r} fill={c} stroke={selected === sg.id ? (dark ? "#fff" : "#15282e") : "#ffffff"} strokeWidth={selected === sg.id ? 3 : 1.6} />
              {mk && <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke={mk === "geobags" ? "#cf4a2f" : "#7356d0"} strokeWidth={2.5} strokeDasharray={mk === "evacuate" ? "4 3" : undefined} />}
              <title>{sg.id}</title>
            </g>
          );
        })}

        {/* labels */}
        <text x={PAD} y={H - 8} fontSize={12} fontWeight={700} fill={ink} letterSpacing="0.08em">SOUTH · CHAUHALI</text>
        <text x={W - PAD} y={H - 8} fontSize={12} fontWeight={700} fill={ink} textAnchor="end" letterSpacing="0.08em">KAZIPUR · NORTH →</text>
        <text x={PAD} y={18} fontSize={12} fontWeight={600} fill={ink}>West bank</text>
        <g transform={`translate(${W - PAD - km10},${18})`}>
          <line x1={0} x2={km10} y1={0} y2={0} stroke={ink} strokeWidth={2} />
          <line x1={0} x2={0} y1={-4} y2={4} stroke={ink} strokeWidth={2} />
          <line x1={km10} x2={km10} y1={-4} y2={4} stroke={ink} strokeWidth={2} />
          <text x={km10 / 2} y={-6} fontSize={11} fill={ink} textAnchor="middle">10 km</text>
        </g>
      </svg>
      {hover && hv && (
        <div className="ribbon-tip" style={{ left: Math.min(hover.x + 14, (wrap.current?.clientWidth ?? 600) - 200), top: Math.max(0, hover.y - 90) }}>
          <b>{hv.id}</b> <span className={`pill ${hv.level === "red" ? "red" : "amber"}`} style={{ marginLeft: 6 }}>{hv.level === "red" ? "High risk" : "Watch"}</span>
          <div className="muted" style={{ marginTop: 4 }}>{hv.side === "west" ? "West" : "East"} bank · moved {hv.retreat_m} m</div>
          {prob?.has(hv.id) && <div>Chance of moving next pass: <b style={{ fontSize: 14 }}>{Math.round((prob.get(hv.id) ?? 0) * 100)}%</b></div>}
          <div>People in the way: <b style={{ fontSize: 14 }}>{nf(people?.get(hv.id) ?? Math.round(hv.homes_near * 3.98))}</b></div>
          {marks?.get(hv.id) && <div style={{ marginTop: 4, fontWeight: 700 }}>{marks.get(hv.id) === "geobags" ? "→ Geobag crew" : "→ Evacuation places"}</div>}
        </div>
      )}
    </div>
  );
}

export function RibbonLegend({ mode, dark }: { mode: "level" | "prob" | "plan"; dark?: boolean }) {
  const style = { color: dark ? "rgba(232,242,241,0.8)" : "var(--mist)" };
  return (
    <div className="ribbon-legend" style={style}>
      {mode === "prob" ? (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>Chance of moving next pass
          <span style={{ width: 120, height: 8, borderRadius: 8, background: `linear-gradient(90deg, ${probColor(0)}, ${probColor(0.5)}, ${probColor(1)})` }} /> 0 → 100%</span>
      ) : (
        <><span><i style={{ background: LEVEL_COLOR.red }} />High risk</span><span><i style={{ background: LEVEL_COLOR.amber }} />Watch</span></>
      )}
      {mode === "plan" && <><span><i style={{ background: "transparent", border: "2px solid #cf4a2f" }} />Geobag crew</span><span><i style={{ background: "transparent", border: "2px dashed #7356d0" }} />Evacuation</span></>}
      <span>Dot size = people in the way</span>
      <span>— bank on 22 Sep · - - bank on 18 Jun</span>
    </div>
  );
}

// ---------------- gauges ----------------
export function Ring({ value, total, color, size = 132, stroke = 13, label, track = "#ebe5d9" }: {
  value: number; total: number; color: string; size?: number; stroke?: number; label: ReactNode; track?: string;
}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const f = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle className="arc-anim" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - f)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="g-center"><div>{label}</div></div>
    </div>
  );
}

const BANDS = [
  { to: 25, color: "#8fb7c9", name: "low" }, { to: 75, color: "#0f7c8c", name: "normal" },
  { to: 90, color: "#d0901c", name: "high" }, { to: 100, color: "#cf4a2f", name: "very high" },
];
/** Half-circle dial for the river level percentile (0 = lowest for the date, 100 = highest). */
export function Dial({ pct, size = 220, dark = false }: { pct: number | null; size?: number; dark?: boolean }) {
  const cx = size / 2, cy = size / 2 + 6, r = size / 2 - 18;
  const pt = (v: number, rr = r) => {
    const a = Math.PI * (1 - v / 100);
    return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)] as const;
  };
  let from = 0;
  const v = pct ?? 0;
  const [nx, ny] = pt(v, r - 22);
  return (
    <svg width={size} height={size / 2 + 26} viewBox={`0 0 ${size} ${size / 2 + 26}`} role="img" aria-label={`River level at the ${pct ?? "?"}th percentile for this date`}>
      {BANDS.map((b) => {
        const [x1, y1] = pt(from), [x2, y2] = pt(b.to);
        const d = `M${x1},${y1} A${r},${r} 0 0 1 ${x2},${y2}`;
        from = b.to;
        return <path key={b.name} d={d} fill="none" stroke={b.color} strokeWidth={14} strokeOpacity={0.9} />;
      })}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={dark ? "#fff" : "#15282e"} strokeWidth={4} strokeLinecap="round" style={{ transition: "all .9s" }} />
      <circle cx={cx} cy={cy} r={8} fill={dark ? "#fff" : "#15282e"} />
      <text x={pt(0)[0]} y={cy + 20} fontSize={11} textAnchor="middle" fill={dark ? "#cfe" : "#8b9799"}>low</text>
      <text x={pt(100)[0]} y={cy + 20} fontSize={11} textAnchor="middle" fill={dark ? "#cfe" : "#8b9799"}>high</text>
    </svg>
  );
}

export function Bar({ value, max = 1, color, mark }: { value: number; max?: number; color: string; mark?: number }) {
  return (
    <div className="bar-track">
      <div className="bar-fill" style={{ width: `${Math.max(2, Math.min(100, (value / max) * 100))}%`, background: color }} />
      {mark !== undefined && <span className="bar-mark" style={{ left: `${(mark / max) * 100}%` }} />}
    </div>
  );
}

const Person = ({ fill }: { fill: string }) => (
  <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="5" r="3.4" fill={fill} /><path d="M3.5 19c0-4.4 2.9-7.4 6.5-7.4s6.5 3 6.5 7.4z" fill={fill} /></svg>
);
/** Inline person icon for counts of people. */
export const PersonGlyph = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" style={{ verticalAlign: "-2px" }}><circle cx="10" cy="5" r="3.4" fill={color} /><path d="M3.5 19c0-4.4 2.9-7.4 6.5-7.4s6.5 3 6.5 7.4z" fill={color} /></svg>
);
/** n person icons, the first `filled` in colour. */
export function People({ n = 20, filled, color = "#7356d0" }: { n?: number; filled: number; color?: string }) {
  return <div className="pict">{Array.from({ length: n }, (_, i) => <Person key={i} fill={i < filled ? color : "#e3dccd"} />)}</div>;
}

// ---------------- map safety net ----------------
export function hasWebGL(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Keeps a page alive when the WebGL map cannot start (old device, blocked GPU, headless browser). */
export class MapBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: !hasWebGL() };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* shown below */ }
  render() {
    if (this.state.failed) {
      return this.props.fallback ?? (
        <div className="map-fallback"><div><h3 style={{ margin: 0 }}>The live map needs WebGL</h3>
          <p>This browser could not start the 3D map. Everything else works; the river drawing on this page shows the same stretches.</p></div></div>
      );
    }
    return this.props.children;
  }
}
