"""Tests for the Climate Shield modules: outlook, hazard model, exposure, planner."""
from datetime import date, timedelta

import numpy as np
import pytest

from src.compute import exposure as ex
from src.compute import hazard as hz
from src.compute import outlook as ol
from src.compute import planner as pl

# ---------------- outlook ----------------


def _history(years=range(2000, 2010), base=20000.0):
    h = {}
    for y in years:
        d = date(y, 1, 1)
        while d.year == y:
            h[d.isoformat()] = base + 1000.0 * (y - 2000)
            d += timedelta(days=1)
    return h


def test_climatology_window_and_rank():
    h = _history()
    clim = ol.climatology(h, "2026-07-15", window=3)
    assert clim.size == 10 * 7
    assert ol.percentile_rank(clim, 20000.0) == 10.0
    assert ol.percentile_rank(clim, 99999.0) == 100.0
    assert ol.percentile_rank(np.array([]), 1.0) is None


def test_bands_and_trend():
    assert ol.band(95) == "very high" and ol.band(80) == "high" and ol.band(50) == "normal" and ol.band(10) == "low"
    assert ol.trend([100, 101, 102, 103, 104, 105, 106, 110])["trend"] == "rising"
    assert ol.trend([100, 99, 98, 97, 96, 95, 94, 90])["trend"] == "falling"
    assert ol.trend([100, 101, 100, 102, 100, 101, 100, 102])["trend"] == "steady"
    assert ol.trend([1])["trend"] == "unknown"


def test_outlook_today_peak_and_leave_year_out():
    h = _history(range(2000, 2027))
    series = [{"date": (date(2026, 7, 1) + timedelta(days=k)).isoformat(), "q": 20000.0 + 2000 * k} for k in range(10)]
    o = ol.outlook(series, h, "2026-07-03")
    assert o["today"]["date"] == "2026-07-03"
    assert o["trend_7d"]["trend"] == "rising"
    assert o["peak"]["date"] == "2026-07-10" and o["peak"]["days_ahead"] == 7
    assert all(d["forecast"] == (d["date"] > "2026-07-03") for d in o["days"])
    with pytest.raises(ValueError):
        ol.outlook([], h, "2026-07-03")


def test_escalate():
    assert ol.escalate("red", "falling", "low") == {"priority": "act now", "escalated": False}
    assert ol.escalate("amber", "rising", "normal")["escalated"] is True
    assert ol.escalate("amber", "steady", "very high")["priority"] == "act now"
    assert ol.escalate("amber", "falling", "normal")["priority"] == "watch"
    assert ol.escalate("green", "rising", "high")["priority"] == "routine"


def test_basin_rain():
    r = ol.basin_rain([{"name": "a", "total_mm": 10}, {"name": "b", "total_mm": 30}, {"name": "c", "total_mm": None}])
    assert r == {"median_mm": 20.0, "max_mm": 30.0, "wettest": "b"}


# ---------------- hazard ----------------

DATES = ["2026-06-18", "2026-06-30", "2026-07-12", "2026-07-24", "2026-08-17", "2026-08-29", "2026-09-10", "2026-09-22"]
WATER = [450.0, 610.0, 700.0, 960.0, 640.0, 820.0, 600.0, 560.0]
RAIN = [178.0, 128.0, 297.0, 150.0, 120.0, 90.0, 60.0, 40.0]


def _stretches(n=40, seed=0):
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        rate = rng.uniform(0, 40) if i % 2 else rng.uniform(-5, 10)
        h, pos = [0.0], 0.0
        for k in range(1, len(DATES)):
            pos += rate + (15 if WATER[k] > WATER[k - 1] else -10) + rng.normal(0, 8)
            h.append(round(pos, 1))
        out.append({"id": f"S{i:02d}", "side": "east" if i % 3 else "west", "history_m": h, "level": "amber"})
    return out


def test_features_need_two_earlier_passes():
    h = [0.0, 10.0, None, 40.0, 50.0, 60.0, 70.0, 80.0]
    assert hz.features_at(h, 1, DATES, WATER, RAIN, "east", 1) is None
    assert hz.features_at(h, 3, DATES, WATER, RAIN, "east", 1) is None  # pass 2 missing
    x = hz.features_at(h, 5, DATES, WATER, RAIN, "west", 0)
    assert x[:3] == [10.0, 10.0, 60.0] and x[7] == 0.0 and x[8] == 0.0
    assert len(x) == len(hz.NAMES)


def test_panel_labels_use_next_pass_only():
    s = [{"id": "A", "side": "east", "history_m": [0, 0, 0, 0, 40, 40, 40, 100]}]
    rows = hz.build_panel(s, DATES, WATER, RAIN)
    assert [(r.k, r.y) for r in rows] == [(2, 0), (3, 1), (4, 0), (5, 0), (6, 1)]


def test_backtest_is_rolling_origin_and_reproducible():
    rows = hz.build_panel(_stretches(), DATES, WATER, RAIN)
    a = hz.backtest(rows, 4)
    b = hz.backtest(rows, 4)
    assert a == b
    assert a["tested_passes"] == [4, 5, 6]
    assert set(a["models"]) == {"logistic", "gboost", "base_rate", "persistence", "trend"}
    assert a["models"]["gboost"]["n"] == sum(1 for r in rows if r.k >= 4)


def test_train_and_predict_outputs_probabilities_and_drivers():
    out = hz.train_and_predict(_stretches(), DATES, WATER, RAIN)
    assert out["model"] in ("logistic", "gboost")
    s = out["stretches"][0]["scenarios"]
    for scen in ("river_rising", "river_not_rising"):
        assert 0.0 <= s[scen]["p"] <= 1.0
        assert len(s[scen]["drivers"]) == 3
    assert out["from_pass"] == DATES[-1]


def test_train_refuses_tiny_panels():
    with pytest.raises(ValueError):
        hz.train_and_predict(_stretches(2), DATES, WATER, RAIN)


# ---------------- exposure ----------------

RING = [[89.0, 24.0], [89.01, 24.0], [89.01, 24.01], [89.0, 24.01], [89.0, 24.0]]


def test_point_in_polygon_and_distance():
    assert ex.point_in_polygon([89.005, 24.005], RING)
    assert not ex.point_in_polygon([89.02, 24.005], RING)
    d = ex.dist_to_line_m([89.0, 24.001], [[89.0, 24.0], [89.01, 24.0]])
    assert 108 < d < 114  # 0.001 deg of latitude ~ 111 m


def test_stretch_exposure_zones():
    bank = [[[89.0, 24.0], [89.01, 24.0]]]
    homes = [[89.005, 24.0005], [89.005, 24.0015], [89.005, 24.009], [89.05, 24.0005]]  # ~55 m, ~167 m, ~1 km, outside
    e = ex.stretch_exposure(RING, homes, bank, 60.0, 200.0, [{"kind": "school", "lat": 24.002, "lon": 89.002}])
    assert e["homes"] == 3
    assert e["homes_in_expected_zone"] == 1 and e["homes_in_high_zone"] == 2
    assert e["people_est"] == round(3 * ex.HOUSEHOLD_SIZE)
    assert e["assets"] == {"school": 1}
    assert e["nearest_home_m"] in range(50, 60)


def test_exposure_without_forecast():
    e = ex.stretch_exposure(RING, [[89.005, 24.005]], [], None, None)
    assert e["homes_in_high_zone"] == 0 and e["nearest_home_m"] is None


# ---------------- planner ----------------

PL = [
    {"id": "A", "p": 0.8, "people_est": 100, "people_in_high_zone_est": 50},   # 40
    {"id": "B", "p": 0.5, "people_est": 400, "people_in_high_zone_est": 0},    # 0.5*0.25*400 = 50
    {"id": "C", "p": 0.2, "people_est": 80, "people_in_high_zone_est": 80},    # 16
    {"id": "D", "p": 0.0, "people_est": 500, "people_in_high_zone_est": 500},  # 0
]


def test_plan_greedy_crews_then_shelter():
    r = pl.plan(PL, crews=1, shelter=60)
    assert r["actions"][0] == {"id": "B", "action": "geobags", "expected_people": 50.0}
    assert r["actions"][1] == {"id": "A", "action": "evacuate", "places": 50, "expected_people": 40.0}
    assert r["actions"][2]["id"] == "C" and r["actions"][2]["places"] == 10
    assert r["shelter_unused"] == 0
    assert r["expected_people_total"] == 106.0


def test_plan_zero_resources_and_validation():
    r = pl.plan(PL, 0, 0)
    assert r["actions"] == [] and r["expected_people_covered"] == 0
    with pytest.raises(ValueError):
        pl.plan(PL, -1, 0)
