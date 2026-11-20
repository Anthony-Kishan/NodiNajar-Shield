"""
Critical assets near the Jamuna bank from OpenStreetMap (Overpass API):
schools, mosques and other places of worship, health posts, markets.

    python tools/fetch_osm_assets.py      # writes data/osm_assets.json for the AOI box
    python -m src.pipeline.export_shield  # counts them per stretch

Data (c) OpenStreetMap contributors, ODbL. Standard library only.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OVERPASS = "https://overpass-api.de/api/interpreter"
BOX = (24.00, 89.60, 24.72, 89.92)  # south, west, north, east (aoi/jamuna_sirajganj.geojson)
KINDS = {
    "school": '["amenity"~"^(school|college|kindergarten)$"]',
    "worship": '["amenity"="place_of_worship"]',
    "health": '["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]',
    "market": '["amenity"="marketplace"]',
    "shelter": '["amenity"="shelter"]',
}


def main() -> None:
    s, w, n, e = BOX
    parts = "".join(f"nwr{f}({s},{w},{n},{e});" for f in KINDS.values())
    q = f"[out:json][timeout:90];({parts});out center tags;"
    req = urllib.request.Request(OVERPASS, data=urllib.parse.urlencode({"data": q}).encode(),
                                 headers={"User-Agent": "NodiNajar-Shield/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.loads(r.read())
    assets = []
    for el in j["elements"]:
        t = el.get("tags", {})
        lat = el.get("lat") or el.get("center", {}).get("lat")
        lon = el.get("lon") or el.get("center", {}).get("lon")
        if lat is None:
            continue
        a = t.get("amenity", "")
        kind = ("school" if a in ("school", "college", "kindergarten") else "worship" if a == "place_of_worship"
                else "market" if a == "marketplace" else "shelter" if a == "shelter" else "health")
        assets.append({"kind": kind, "name": t.get("name:en") or t.get("name") or "", "lat": lat, "lon": lon,
                       "osm": f"{el['type']}/{el['id']}"})
    out = ROOT / "data" / "osm_assets.json"
    out.write_text(json.dumps({"source": "OpenStreetMap contributors (ODbL), via Overpass API", "box": BOX,
                               "assets": assets}))
    print(f"{len(assets)} assets -> {out}")


if __name__ == "__main__":
    main()
