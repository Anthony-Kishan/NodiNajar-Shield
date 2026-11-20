"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useNow, useRiver } from "@/lib/data";
import { fmtDate } from "@/lib/format";
import { nextPass } from "@/lib/schedule";
import { IconBell, IconCheck, IconLayers, IconBook, IconChat, IconGrid, IconMap, IconSat, IconShield, IconTrend, IconUsers, IconWaves, Mark } from "./Icons";

const MAIN = [
  { href: "/", label: "Overview", icon: IconGrid },
  { href: "/map/", label: "Map", icon: IconMap },
  { href: "/forecast/", label: "Forecast", icon: IconTrend, ai: true },
  { href: "/plan/", label: "Plan", icon: IconUsers },
  { href: "/assistant/", label: "Ask", icon: IconChat, ai: true },
];
const MORE = [
  { href: "/banks/", label: "Bank stretches", sub: "Every 500 m stretch, ranked", icon: IconWaves },
  { href: "/passes/", label: "Radar passes", sub: "The 8 NISAR images, side by side", icon: IconSat },
  { href: "/why/", label: "Why it moves", sub: "Rain, river level and the bank", icon: IconLayers },
  { href: "/proof/", label: "Track record", sub: "Back-test against news reports", icon: IconCheck },
  { href: "/alerts/", label: "Alerts", sub: "Bangla and English SMS", icon: IconBell },
  { href: "/embankments/", label: "Embankments", sub: "Coming next: InSAR", icon: IconShield },
  { href: "/methods/", label: "Methods & data", sub: "How every number is made", icon: IconBook },
];
export const TABS = [...MAIN, ...MORE];

function countdown(days: number): string {
  const s = Math.max(0, Math.round(days * 86400));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return d > 0 ? `${d}d ${h}h ${String(m).padStart(2, "0")}m` : `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function LiveStatus() {
  const { data } = useRiver();
  const now = useNow(1000);
  if (!data) return <div className="live"><span className="live-text">Loading radar data…</span></div>;
  const m = data.manifest;
  const last = m.passes[m.passes.length - 1].date;
  const next = nextPass(m, now);
  return (
    <div className="live" title="NISAR repeats this track every 12 days; the next date is the expected pass, not yet observed">
      <span className="pulse-dot" />
      <span className="live-text">Data to <b>{fmtDate(last, true)}</b>{next && <> · next NISAR pass in <b className="num">{countdown(next.daysAway)}</b></>}</span>
    </div>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  const isActive = (href: string) => (href === "/" ? norm(path) === "/" : norm(path).startsWith(href));
  const moreActive = MORE.some((t) => isActive(t.href));
  return (
    <>
      <header className="header">
        <div className="header-row">
          <Link href="/" className="brand" aria-label="NodiNajar home">
            <Mark />
            <div>
              <h1>NodiNajar<span lang="bn">নদীনজর</span></h1>
              <p>Riverbank early warning · Jamuna, Bangladesh</p>
            </div>
          </Link>
          <div className="header-spacer" />
          <nav className="nav" aria-label="Sections">
            {MAIN.map(({ href, label, icon: I, ai }) => (
              <Link key={href} href={href} className={isActive(href) ? "active" : undefined} aria-current={isActive(href) ? "page" : undefined}>
                <I /> {label} {ai && <span className="ai">AI</span>}
              </Link>
            ))}
            <details className="more" key={path}>
              <summary className={moreActive ? "active" : undefined}>More ▾</summary>
              <div className="more-menu">
                {MORE.map(({ href, label, sub, icon: I }) => (
                  <Link key={href} href={href} className={isActive(href) ? "active" : undefined}>
                    <span className="ico"><I /></span>
                    <span>{label}<small>{sub}</small></span>
                  </Link>
                ))}
              </div>
            </details>
          </nav>
          <div className="header-spacer" />
          <LiveStatus />
          <span className="badge" title="NISAR science data is provisional (validated at a limited set of sites)">NISAR · PROVISIONAL</span>
        </div>
      </header>
      {children}
      <nav className="mobile-nav" aria-label="Sections (mobile)">
        {[...MAIN.slice(0, 4), { href: "/assistant/", label: "Ask", icon: IconChat, ai: true }].map(({ href, label, icon: I }) => (
          <Link key={href} href={href} className={isActive(href) ? "active" : undefined}><I /> {label}</Link>
        ))}
      </nav>
    </>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      Radar: NASA-ISRO NISAR L2 GCOV (provisional) via NASA ASF DAAC · Homes: Overture Maps (OpenStreetMap, Google, Microsoft) ·
      Forecast: Copernicus GloFAS via Open-Meteo · Team AlphaMatrix · Open source (Apache-2.0)
    </footer>
  );
}
