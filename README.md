# NodiNajar (নদীনজর) · Riverbank early warning

**Climate Shield: climate risk prediction and disaster early warning. Team AlphaMatrix.**

Every monsoon the Jamuna takes homes, schools and farmland in Sirajganj, Bangladesh, often overnight. Today families mostly learn which bank is going from the river itself, or from the newspaper afterwards.

NodiNajar watches the bank from orbit and warns before the land goes:

1. **Sense.** NASA-ISRO NISAR L-band radar sees through monsoon cloud. We measure how far every 500 m stretch of the outer bank moves between passes (8 passes, 18 Jun to 22 Sep 2026).
2. **Predict.** A machine-learning model, back-tested against simple baselines, gives each stretch a probability of moving at least 30 m inland by the next pass. A daily river outlook (Copernicus GloFAS discharge, NOAA GFS rain) says whether that pass comes on a rising river.
3. **Expose.** Homes (Overture Maps), people (homes × census household size) and critical assets (OpenStreetMap) inside the forecast loss zone.
4. **Act.** Ranked priorities, a response planner that puts limited geobag crews and shelter places where they protect the most people, fixed-template Bangla/English alerts, and an AI assistant officials can question in Bangla or English.

> **Data status:** NISAR products are **provisional**. Forecasts are labelled as forecasts; people counts are estimates. The ML model is trained on one monsoon; read [`docs/MODEL_CARD.md`](docs/MODEL_CARD.md) before relying on it.

## What's new in this build

This repository builds on our earlier open-source project [NodiNajar](https://github.com/Anthony-Kishan/NodiNajar) (NISAR pipeline, bank-line engine, first web app, trend forecast and news back-test). The first commit here imports that work unchanged; everything after it was built for this event:

| Module | Code | What it does |
| --- | --- | --- |
| ML erosion-hazard model | `src/compute/hazard.py` | Gradient-boosted trees vs logistic regression vs three baselines, rolling-origin back-test, per-stretch drivers (occlusion) |
| River outlook | `src/compute/outlook.py`, `tools/fetch_outlook.py` | GloFAS v4 discharge vs 30+ years of the same days, 7-day trend, peak, basin rain; escalates watch stretches when the river rises |
| Exposure | `src/compute/exposure.py`, `tools/fetch_osm_assets.py` | Homes and people inside the expected and high-end forecast zones; schools, mosques, health posts, markets |
| Response planner | `src/compute/planner.py`, `webapp/lib/shield.ts` | Allocates crews and shelter places by expected people protected; same rules in Python and TypeScript (checked equal) |
| AI assistant | `webapp/app/api/assistant/route.ts` | Tool-using Claude agent over 8 read-only tools, with retrieval over our docs and news reports and a number-grounding guardrail |
| MCP server | `mcp_server/server.py` | The same tools for Claude Desktop, Claude Code or any MCP client |
| Web app | `webapp/app/{forecast,plan,assistant}` | Forecast, Response plan and Ask NodiNajar tabs; early-warning card on the Overview |

### Back-test result (2026 monsoon)

To score a pass, the model only saw labels known before it. 49 held-out checks on 3 passes:

| Model | Brier (lower is better) | AUC |
| --- | --- | --- |
| **Gradient-boosted trees (shipped)** | **0.190** | **0.682** |
| Logistic regression | 0.207 | 0.634 |
| Base rate (no learning) | 0.263 | n/a |
| Theil-Sen trend (our earlier forecast) | 0.367 | 0.512 |
| Last interval repeats | 0.653 | 0.332 |

Small sample, one season, stretches selected because they moved. Limits in the model card.

## Run it

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -q                                              # all tests should pass

# Optional live data (free, no account or key):
python tools/fetch_outlook.py                          # GloFAS discharge + GFS rain  -> data/outlook_raw.json
python tools/fetch_osm_assets.py                       # OpenStreetMap assets         -> data/osm_assets.json

# Rebuild the outputs the app reads (webapp/public/data):
python -m src.pipeline.scorecard                       # trend forecast + news back-test
python -m src.pipeline.export_shield                   # hazard, exposure, outlook, priorities
python -m src.agent.knowledge                          # knowledge base for the assistant

# Web app
cd webapp && npm install && npm run dev                # http://localhost:3000
```

**Assistant:** set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in `webapp/.env.local` or in the Vercel project settings. Without a key the rest of the app works and the assistant page says it is not configured.

**MCP server:** `python -m mcp_server.server` (stdio) or `--http`. Claude Desktop config:

```json
{"mcpServers": {"nodinajar": {"command": "python", "args": ["-m", "mcp_server.server"], "cwd": "/path/to/NodiNajar-Shield"}}}
```

**Deploy:** import the repo in Vercel with Root Directory `webapp`, add `ANTHROPIC_API_KEY`.

**Rebuilding the radar results from NISAR** (Earthdata login needed) is documented in [`docs/COVERAGE.md`](docs/COVERAGE.md) and [`docs/METHODS.md`](docs/METHODS.md): `tools/fetch_subset.py`, then `python -m src.pipeline.build_demo` and `python -m src.pipeline.export_web`.

## Repository layout

```
src/compute/     the science, deterministic and tested: water mask, bank lines, retreat, trend forecast,
                 news back-test, hazard model, river outlook, exposure, planner
src/agent/       assistant tools, knowledge retrieval (TF-IDF), number-grounding guardrail
src/pipeline/    exports for the web app (export_web, scorecard, export_shield)
mcp_server/      MCP server over src/agent/tools.py
tools/           NISAR coverage and box-only download, outlook and OpenStreetMap fetchers, checks
webapp/          Next.js app (MapLibre GL, deck.gl, Recharts) + /api/assistant
web/             fully offline demo (open web/index.html)
api/             FastAPI + PostGIS scaffold
ground_truth/    dated, sourced erosion reports from Bangladeshi newspapers
docs/            methods, model card, coverage, AI use log
tests/           pytest for everything in src/
```

## Rules we follow

- All numbers shown to users come from tested code in `src/compute`. **Language models never compute or invent a number.** Trained ML models are allowed when they are versioned, tested, back-tested against baselines and labelled as forecasts.
- The assistant reads data only through tools and every number in its answers is checked against the tool results.
- Alerts are fixed Bangla/English templates filled from computed numbers.
- NISAR output is labelled PROVISIONAL, forecasts MODEL FORECAST, people counts estimates.
- AI use is logged in [`docs/AI_USE.md`](docs/AI_USE.md).

## Data and credits

NASA data:

- NASA-ISRO NISAR L-band L2 GCOV (HH, HV), track 69 frame 14, 8 passes, via the NASA Alaska Satellite Facility DAAC (provisional products)
- NASA GIBS daily VIIRS (Suomi NPP) Corrected Reflectance true colour
- NASA HLS v2.0 (Harmonized Landsat and Sentinel-2) true colour via NASA GIBS
- NASA JPL OPERA DSWx-HLS surface water via NASA GIBS (independent check of our water masks)
- NASA POWER daily precipitation (PRECTOTCORR; MERRA-2 and GEOS-IT)

Other data:

- Copernicus Emergency Management Service GloFAS v4 river discharge, via the Open-Meteo Flood API
- NOAA GFS precipitation forecast, via the Open-Meteo API
- Overture Maps buildings; OpenStreetMap contributors (ODbL) for critical assets
- Bangladesh Population and Housing Census 2022 (BBS): average household size 3.98
- Basemaps: Esri World Imagery, Topographic, Street and Dark Gray Canvas; Sentinel-2 cloudless 2025 by EOX (CC BY-NC-SA 4.0); Mapzen Terrain Tiles on AWS Open Data
- Bangladeshi newspaper reports of erosion, each linked in `ground_truth/events.csv`
- Software: Next.js, MapLibre GL, deck.gl, Recharts, NumPy, SciPy, scikit-learn, h5py, MCP Python SDK; Anthropic Claude API for the assistant

## Team AlphaMatrix

| Member | Role |
| --- | --- |
| Kishan Modhu | Team lead, ML and back-test |
| Kazi Majedul Islam | Backend, research, geospatial |
| Mahbub Al Hasan Akib | Radar (SAR), video editing |
| Raihana Ferdosh | Story, video and presentation |

Licence: Apache-2.0 (see `LICENSE`).
