/**
 * Editable content for /docs. Numbers are NOT written here: the page reads them live from
 * public/data/*.json (the same files the app uses). Edit text here, commit, and Vercel redeploys;
 * git history is the version history.
 */

export const REPO = "Anthony-Kishan/NodiNajar-Shield";
export const ORIGINAL_REPO = "https://github.com/Anthony-Kishan/NodiNajar";

export interface Member { name: string; role: string; email: string; photo?: string }

/**
 * Team. Photos: put a square JPG in webapp/public/team/ and set photo: "/team/name.jpg".
 * Any size works: the page crops every photo to the same circle. Missing photos show initials.
 */
export const TEAM: { name: string; members: Member[] } = {
  name: "Team NodiNajar",
  members: [
    { name: "Kishan Modhu", role: "Team lead · ML hazard model", email: "" },
    { name: "Kazi Majedul Islam", role: "Backend · geospatial pipeline", email: "" },
    { name: "Mahbub Al Hasan Akib", role: "Radar processing · video", email: "" },
    { name: "Raihana Ferdosh", role: "Story · video · presentation", email: "" },
  ],
};

export interface Slide { id: string; title: string; body: string[] }

/** YC-style pitch. Live numbers are added by the page next to these slides. */
export const PITCH: Slide[] = [
  { id: "problem", title: "Problem", body: [
    "Every monsoon the Jamuna moves sideways and takes homes, schools and farmland in Sirajganj, sometimes overnight.",
    "Cloud hides the river from optical satellites exactly when it moves fastest. Warnings mostly arrive as newspaper reports after the loss.",
    "Officials with a few geobag crews and limited shelter space have no ranked list of which stretch to protect first, or how many people live there.",
  ] },
  { id: "solution", title: "Solution", body: [
    "NodiNajar measures every 500 m of bank from NASA-ISRO NISAR L-band radar, which sees through cloud, every 12 days.",
    "A back-tested ML model forecasts which stretches move next; a daily river forecast escalates them when the river is about to rise.",
    "It counts the homes and people in the way, plans where crews and shelter places protect the most people, and drafts Bangla/English alerts from fixed templates.",
  ] },
  { id: "why-now", title: "Why now", body: [
    "NISAR's first open L-band radar data covers Bangladesh in 2026: free, through cloud, on a fixed 12-day cycle.",
    "Free river forecasts (Copernicus GloFAS) and open building footprints (Overture) make the exposure and outlook layers possible at no cost.",
    "Tool-using AI models can now explain a forecast in Bangla to a union official, while a guardrail keeps every number tied to the data.",
  ] },
  { id: "demo", title: "Product demo", body: [
    "Overview → Map (2D, 3D, before/after radar) → Forecast → Response plan (crew and shelter sliders) → Ask NodiNajar → Bangla SMS alerts.",
  ] },
  { id: "market", title: "Market opportunity", body: [
    "Users: Bangladesh Water Development Board field offices, the Department of Disaster Management, upazila and union parishad disaster committees, and NGOs that run anticipatory action.",
    "The same method applies to the other braided rivers that NISAR covers (Teesta, Padma, Brahmaputra in Assam), and to embankment sinking with InSAR.",
  ] },
  { id: "business", title: "Business model", body: [
    "Free for communities and public alert channels.",
    "Paid per-district dashboards, API and SMS delivery for government agencies, humanitarian donors and insurers that fund anticipatory action (planned; no revenue yet).",
  ] },
  { id: "traction", title: "Traction", body: [
    "Working product on 8 NISAR passes (June to September 2026), live on Vercel, open source.",
    "Back-tested against four alternative models and against dated newspaper reports (live numbers below).",
  ] },
  { id: "competition", title: "Competition", body: [
    "Flood forecasts (FFWC, Google Flood Hub) say when water rises, not which bank goes next.",
    "Seasonal erosion predictions from optical imagery come once a year and cannot see through monsoon cloud.",
    "NodiNajar adds a 12-day, cloud-proof bank measurement, a per-stretch forecast, the people at risk and a crew plan in one place.",
  ] },
  { id: "advantage", title: "Unique advantage", body: [
    "Radar-first: works in the season that matters. Every number is traceable to a dated pass or a named dataset.",
    "Honest by design: provisional and forecast labels everywhere, a back-test anyone can rerun, and an AI that may only quote tool results.",
  ] },
  { id: "gtm", title: "Go-to-market", body: [
    "Pilot with Sirajganj union parishads and one NGO running anticipatory action in the 2027 monsoon.",
    "Then district dashboards for BWDB; then other rivers on the same NISAR tracks.",
  ] },
  { id: "vision", title: "Vision", body: [
    "No family on a Bangladesh riverbank should learn from the newspaper that their home is gone. Every stretch watched through cloud, every warning in Bangla, days before the bank moves.",
  ] },
];

export const PRODUCT = {
  what: "A riverbank early-warning system: radar measurement, ML forecast, exposure count, response planner, Bangla alerts and an AI assistant over the same data.",
  users: ["Union parishad and upazila disaster committees", "Bangladesh Water Development Board field engineers", "NGOs running anticipatory action", "Journalists and researchers"],
  useCases: ["Which 500 m stretches are likely to move before the next radar pass?", "How many homes and people are in the way?", "With 5 crews and 500 shelter places, where do we act first?", "Send the fixed Bangla alert for one stretch", "Ask in Bangla why a stretch is rated high"],
};

export type Status = "live" | "beta" | "next" | "planned";
export interface Feature { name: string; page?: string; status: Status; data?: string; note: string }

export const FEATURES: Feature[] = [
  { name: "Radar bank-line measurement", page: "/passes/", status: "live", data: "manifest.json", note: "8 NISAR passes, every 500 m stretch" },
  { name: "Map: 2D, 3D, before/after", page: "/map/", status: "live", data: "segments.geojson", note: "MapLibre + deck.gl" },
  { name: "ML erosion-hazard forecast", page: "/forecast/", status: "live", data: "hazard.json", note: "Gradient-boosted trees, back-tested" },
  { name: "Daily river outlook", page: "/forecast/", status: "live", data: "outlook.json", note: "Copernicus GloFAS + NOAA GFS" },
  { name: "People and places exposed", page: "/plan/", status: "live", data: "exposure.json", note: "Overture buildings × census household size" },
  { name: "Response planner", page: "/plan/", status: "live", data: "priorities.json", note: "Crews and shelter places, greedy optimiser" },
  { name: "Ask NodiNajar (AI assistant)", page: "/assistant/", status: "live", note: "Gemini 2.5 Flash / Claude, 9 tools, grounding check" },
  { name: "Bangla/English SMS alerts", page: "/alerts/", status: "beta", note: "Fixed templates; sending not connected yet" },
  { name: "News back-test", page: "/proof/", status: "live", data: "scorecard.json", note: "Dated newspaper erosion reports" },
  { name: "MCP server", status: "live", note: "mcp_server/server.py, 9 read-only tools" },
  { name: "Embankment sinking (InSAR)", page: "/embankments/", status: "next", note: "NISAR interferometry" },
  { name: "Live SMS via union parishads", status: "planned", note: "Gateway + opt-in lists" },
  { name: "Teesta and Padma rivers", status: "planned", note: "Same pipeline, new tracks" },
];

export const STACK: { layer: string; items: string[] }[] = [
  { layer: "Frontend", items: ["Next.js 15 (App Router)", "React 19", "MapLibre GL", "deck.gl", "Recharts", "Fraunces + Manrope + Hind Siliguri"] },
  { layer: "Backend", items: ["Next.js route handlers on Vercel (/api/assistant, /api/docs-admin)", "Python pipeline (src/compute, src/pipeline)", "FastAPI + PostGIS scaffold (api/)"] },
  { layer: "Data", items: ["Static JSON/GeoJSON on Vercel's CDN", "HDF5 (NISAR GCOV) read with h5py", "CSV exports"] },
  { layer: "AI / ML", items: ["scikit-learn HistGradientBoosting + logistic regression", "Gemini 2.5 Flash (function calling)", "Claude (tool use, alternative)", "TF-IDF retrieval", "MCP Python SDK"] },
  { layer: "Infra", items: ["Vercel (web + serverless)", "GitHub Actions (pytest CI)", "Edge middleware (docs access)"] },
];

export const APIS_USED = [
  { name: "NASA Earthdata / ASF DAAC", use: "NISAR GCOV radar granules (range reads of the area only)" },
  { name: "NASA GIBS", use: "VIIRS, HLS and OPERA DSWx imagery for checks and context" },
  { name: "NASA POWER", use: "Daily rain at the study area" },
  { name: "Open-Meteo (Copernicus GloFAS, NOAA GFS)", use: "Daily river discharge forecast and basin rain" },
  { name: "Overpass (OpenStreetMap)", use: "Schools, mosques, health posts, markets" },
  { name: "Overture Maps", use: "Building footprints" },
  { name: "Google Gemini API / Anthropic API", use: "Assistant language model (server-side key)" },
];

export const APIS_EXPOSED = [
  { method: "POST", path: "/api/assistant", auth: "None (public, rate-limited by the model provider)", body: "{ messages: [{ role, content }] }", returns: "Answer, tools used, evidence, grounding check" },
  { method: "GET", path: "/data/*.json", auth: "None (public, CDN cached 1 h)", body: "-", returns: "Pipeline outputs: manifest, hazard, outlook, exposure, priorities, scorecard" },
  { method: "GET", path: "/api/docs-admin", auth: "None", body: "-", returns: "Docs visibility, window, admin status" },
  { method: "POST / DELETE", path: "/api/docs-admin", auth: "Admin token → httpOnly cookie", body: "{ token }", returns: "Admin sign-in / sign-out" },
  { method: "MCP (stdio, HTTP)", path: "mcp_server/server.py", auth: "Local / deployer", body: "Tool calls", returns: "season_summary, list_stretches, get_stretch, river_outlook, model_report, plan_response, alert_for, news_reports, search_knowledge" },
];

export const ROADMAP = {
  short: ["Match every number in an AI answer to the stretch it is about (fix found in testing)", "Connect an SMS gateway for opt-in alerts", "Process each new NISAR pass within a day"],
  mid: ["Pilot with Sirajganj union parishads in the 2027 monsoon", "Embankment sinking from NISAR InSAR", "Teesta and Padma rivers"],
  long: ["District dashboards for BWDB and DDM", "Funding triggers for anticipatory action", "Other NISAR-covered braided rivers in South Asia"],
};

export const SECURITY = [
  "Model API keys live only in server environment variables; the browser never sees them.",
  "All assistant tools are read-only: the AI cannot change data or send alerts.",
  "Alerts come only from fixed templates; the AI cannot write alert text.",
  "Docs access: admin switch and viewing window checked on every request at the edge; admins sign in with a token, stored only as a hash in an httpOnly, secure cookie.",
  "Roles: public viewer (app, docs when open) and admin (docs visibility preview). Data changes happen only through the reviewed git pipeline.",
  "No personal data is stored: homes are building points, people are estimates from census household size.",
];

export const PERFORMANCE = [
  "All data is precomputed by the pipeline and served as static JSON from Vercel's CDN (cached 1 hour), so pages load without a database.",
  "Heavy map layers load only on the map page; this page loads its diagrams as inline SVG.",
  "The assistant keeps the last 10 messages, stops after 6 tool steps and caches data files per request.",
  "The ML model trains and predicts on a CPU in seconds; adding a river means adding tracks, not servers.",
];
