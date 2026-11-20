"""
Fetch the river outlook: GloFAS v4 river discharge (Copernicus Emergency
Management Service) and GFS rain forecasts (NOAA), both through the free
Open-Meteo APIs. No account or key is needed for non-commercial use.

    python tools/fetch_outlook.py                 # writes data/outlook_raw.json
    python -m src.pipeline.export_shield          # turns it into webapp/public/data/outlook.json

GloFAS cells are 0.05 degrees (~5 km). The Jamuna main stem may not sit in the
cell nearest a town, so for each gauge we try a 3 x 3 block of cells around it
and keep the one with the largest recent mean discharge (the main river).
Uses only the Python standard library.
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOOD = "https://flood-api.open-meteo.com/v1/flood"
GFS = "https://api.open-meteo.com/v1/gfs"

GAUGES = [  # downstream gauge first: it is the one the alerts use
    {"name": "Jamuna at Sirajganj", "lat": 24.45, "lon": 89.72},
    {"name": "Jamuna at Bahadurabad (upstream)", "lat": 25.15, "lon": 89.70},
]
RAIN_POINTS = [  # the Jamuna rises on rain over the Brahmaputra basin upstream
    {"name": "Pasighat, Arunachal Pradesh", "lat": 28.07, "lon": 95.33},
    {"name": "Tezpur, Assam", "lat": 26.63, "lon": 92.80},
    {"name": "Guwahati, Assam", "lat": 26.18, "lon": 91.75},
    {"name": "Dhubri, Assam", "lat": 26.02, "lon": 89.98},
    {"name": "Kurigram", "lat": 25.81, "lon": 89.64},
    {"name": "Sirajganj", "lat": 24.45, "lon": 89.70},
]


def get(url: str, params: dict) -> dict:
    q = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(3):
        try:
            with urllib.request.urlopen(q, timeout=60) as r:
                return json.loads(r.read())
        except Exception:  # noqa: BLE001
            if attempt == 2:
                raise
            time.sleep(2 * (attempt + 1))
    raise RuntimeError("unreachable")


def pick_cell(lat: float, lon: float, past_days: int) -> tuple[float, float, dict]:
    best = None
    for dlat in (-0.05, 0.0, 0.05):
        for dlon in (-0.05, 0.0, 0.05):
            j = get(FLOOD, {"latitude": round(lat + dlat, 3), "longitude": round(lon + dlon, 3),
                            "daily": "river_discharge,river_discharge_p25,river_discharge_p75",
                            "past_days": past_days, "forecast_days": 30})
            q = [v for v in j["daily"]["river_discharge"] if v is not None]
            mean = sum(q) / len(q) if q else -1
            if best is None or mean > best[0]:
                best = (mean, j["latitude"], j["longitude"], j)
    return best[1], best[2], best[3]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(ROOT / "data" / "outlook_raw.json"))
    ap.add_argument("--past-days", type=int, default=60)
    ap.add_argument("--history-from", default="1994-01-01")
    ap.add_argument("--rain-days", type=int, default=16)
    a = ap.parse_args()

    gauges = []
    for g in GAUGES:
        lat, lon, j = pick_cell(g["lat"], g["lon"], a.past_days)
        d = j["daily"]
        series = [{"date": t, "q": q, "q_p25": lo, "q_p75": hi} for t, q, lo, hi in
                  zip(d["time"], d["river_discharge"], d["river_discharge_p25"], d["river_discharge_p75"])]
        end = (date.today() - timedelta(days=a.past_days + 1)).isoformat()
        h = get(FLOOD, {"latitude": lat, "longitude": lon, "daily": "river_discharge",
                        "start_date": a.history_from, "end_date": end})
        history = {t: q for t, q in zip(h["daily"]["time"], h["daily"]["river_discharge"]) if q is not None}
        gauges.append({**g, "lat": lat, "lon": lon, "series": series, "history": history})
        print(f"{g['name']}: cell {lat},{lon}, {len(series)} days, {len(history)} history days")

    j = get(GFS, {"latitude": ",".join(str(p["lat"]) for p in RAIN_POINTS),
                  "longitude": ",".join(str(p["lon"]) for p in RAIN_POINTS),
                  "daily": "precipitation_sum", "forecast_days": a.rain_days, "timezone": "Asia/Dhaka"})
    j = j if isinstance(j, list) else [j]
    rain = []
    for p, r in zip(RAIN_POINTS, j):
        vals = [v for v in r["daily"]["precipitation_sum"] if v is not None]
        rain.append({**p, "total_mm": round(sum(vals), 1), "daily": r["daily"]["precipitation_sum"],
                     "dates": r["daily"]["time"]})

    out = {"fetched_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "sources": {"discharge": "Copernicus EMS GloFAS v4 via Open-Meteo Flood API",
                       "rain": "NOAA GFS via Open-Meteo"},
           "gauges": gauges, "rain_points": rain, "rain_days": a.rain_days}
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    Path(a.out).write_text(json.dumps(out))
    print(f"wrote {a.out}")


if __name__ == "__main__":
    main()
