"""
Who and what is in the way: homes and people per stretch, and how many of them
sit inside the distance the river is forecast to advance.

Homes are Overture Maps building points (already filtered by the engine to the
land side within 200 m of the latest bank). People are homes times the average
household size from the Bangladesh Population and Housing Census 2022 (BBS),
which is a planning estimate, labelled as such. Optional critical assets
(schools, mosques, health posts, markets) come from OpenStreetMap when
tools/fetch_osm_assets.py has been run.
"""
from __future__ import annotations

import math

HOUSEHOLD_SIZE = 3.98  # persons per household, Population and Housing Census 2022 (BBS), national
M_PER_DEG_LAT = 111_320.0


def _xy(lon: float, lat: float, lat0: float) -> tuple[float, float]:
    """Local equirectangular metres; fine over a few kilometres."""
    return lon * M_PER_DEG_LAT * math.cos(math.radians(lat0)), lat * M_PER_DEG_LAT


def point_in_polygon(pt: list[float], ring: list[list[float]]) -> bool:
    """Ray casting; ring is a closed list of [lon, lat]."""
    x, y = pt
    inside = False
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        if (y1 > y) != (y2 > y):
            xc = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xc > x:
                inside = not inside
    return inside


def dist_to_line_m(pt: list[float], line: list[list[float]]) -> float:
    """Shortest distance in metres from a point to a polyline (both lon/lat)."""
    lat0 = pt[1]
    px, py = _xy(pt[0], pt[1], lat0)
    best = math.inf
    pts = [_xy(x, y, lat0) for x, y in line]
    if len(pts) == 1:
        return math.hypot(px - pts[0][0], py - pts[0][1])
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
        best = min(best, math.hypot(px - (ax + t * dx), py - (ay + t * dy)))
    return best


def stretch_exposure(ring: list[list[float]], homes: list[list[float]], banks: list[list[list[float]]],
                     advance_expected_m: float | None, advance_high_m: float | None,
                     assets: list[dict] | None = None) -> dict:
    """
    Homes inside the stretch polygon, their distance to the latest bank line, and
    how many fall within the expected and high-end forecast advance.
    """
    inside = [h for h in homes if point_in_polygon(h, ring)]
    d = [min((dist_to_line_m(h, b) for b in banks), default=math.inf) for h in inside]
    within = lambda m: sum(1 for v in d if m is not None and v <= m)  # noqa: E731
    n_exp, n_high = within(advance_expected_m), within(advance_high_m)
    a_in = [a for a in (assets or []) if point_in_polygon([a["lon"], a["lat"]], ring)]
    kinds: dict[str, int] = {}
    for a in a_in:
        kinds[a["kind"]] = kinds.get(a["kind"], 0) + 1
    return {
        "homes": len(inside),
        "people_est": round(len(inside) * HOUSEHOLD_SIZE),
        "homes_in_expected_zone": n_exp,
        "homes_in_high_zone": n_high,
        "people_in_high_zone_est": round(n_high * HOUSEHOLD_SIZE),
        "nearest_home_m": None if not d or min(d) == math.inf else round(min(d)),
        "assets": kinds,
    }
