import type { SVGProps } from "react";
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p });
export const IconGrid = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></svg>;
export const IconMap = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/></svg>;
export const IconWaves = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 8c3-2 6 2 9 0s6 2 9 0M3 13c3-2 6 2 9 0s6 2 9 0M3 18c3-2 6 2 9 0s6 2 9 0"/></svg>;
export const IconSat = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m13 7 4-4 4 4-4 4zM3 17l4-4 4 4-4 4z"/><path d="m9 15 6-6M15 21a6 6 0 0 0 6-6M15 17a2 2 0 0 0 2-2"/></svg>;
export const IconBell = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>;
export const IconShield = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/></svg>;
export const IconBook = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h8"/></svg>;
export const IconCheck = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M20 6 9 17l-5-5"/></svg>;
export const IconPlay = (p: SVGProps<SVGSVGElement>) => <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}><path d="M8 5v14l11-7z"/></svg>;
export const IconPause = (p: SVGProps<SVGSVGElement>) => <svg {...base({ ...p, fill: "currentColor", stroke: "none" })}><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>;
export const IconLayers = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/></svg>;
export const IconX = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 6l12 12M18 6 6 18"/></svg>;
export const IconDownload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14"/></svg>;
export const IconTrend = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>;
export const IconUsers = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/></svg>;
export const IconChat = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>;
export const IconCube = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/></svg>;
export const IconSwipe = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 4v16"/><path d="m8 10-2 2 2 2M16 10l2 2-2 2"/></svg>;
export const Mark = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
    <defs>
      <linearGradient id="nn-mark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#0d3b44" />
        <stop offset="1" stopColor="#13756f" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="38" height="38" rx="12" fill="url(#nn-mark)" />
    <path d="M16 6c6 6-4 9 2 14s-3 9 3 14" fill="none" stroke="#bfeae6" strokeWidth="3.2" strokeLinecap="round" />
    <circle cx="27" cy="15" r="3" fill="#ff9a7f" />
    <circle cx="27" cy="15" r="5.5" fill="none" stroke="#ff9a7f" strokeOpacity=".45" />
  </svg>
);
