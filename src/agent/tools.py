"""
Read-only tools over the NodiNajar results, shared by the MCP server and the
assistant. Each tool returns plain JSON-able dicts taken from the pipeline
outputs in webapp/public/data. No tool computes a new risk number except
plan_response, which runs the tested planner in src/compute/planner.py.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

from src.alerts.templates import alert_text, audience
from src.compute import planner as pl

ROOT = Path(__file__).resolve().parents[2]
DATA = Path(os.environ.get("NODINAJAR_DATA", ROOT / "webapp" / "public" / "data"))


@lru_cache(maxsize=None)
def _j(name: str):
    p = DATA / name
    return json.loads(p.read_text()) if p.exists() else None


def reload() -> None:
    _j.cache_clear()


def _seg_props() -> dict[str, dict]:
    return {f["properties"]["id"]: f["properties"] for f in _j("segments.geojson")["features"]}


def _by_id(name: str) -> dict[str, dict]:
    f = _j(name)
    return {r["id"]: r for r in f["stretches"]} if f else {}


def season_summary() -> dict:
    """Season totals, pass dates and data status."""
    m = _j("manifest.json")
    return {"label": m["label"], "first_pass": m["passes"][0]["date"], "last_pass": m["passes"][-1]["date"],
            "n_passes": len(m["passes"]), "totals": m["totals"], "risk_rule": m["method"]["risk_rule"],
            "exposure_totals": (_j("exposure.json") or {}).get("totals")}


def list_stretches(level: str | None = None, limit: int = 10) -> dict:
    """Stretches ranked by priority: red first, then by bank movement. Optional level filter (red/amber)."""
    segs = sorted(_seg_props().values(), key=lambda s: (s["level"] != "red", -s["retreat_m"]))
    pri = _by_id("priorities.json")
    rows = [{"id": s["id"], "level": s["level"], "side": s["side"], "retreat_m": s["retreat_m"],
             "homes_near": s["homes_near"], "lat": s["centre"][1], "lon": s["centre"][0],
             "p_next_pass": pri.get(s["id"], {}).get("p"), "priority": pri.get(s["id"], {}).get("priority")}
            for s in segs if level is None or s["level"] == level]
    return {"count": len(rows), "stretches": rows[: max(1, min(limit, 50))]}


def get_stretch(stretch_id: str) -> dict:
    """Everything known about one stretch: measurement, forecast, ML hazard, exposure, priority."""
    s = _seg_props().get(stretch_id.upper())
    if not s:
        return {"error": f"unknown stretch {stretch_id}"}
    m = _j("manifest.json")
    fc = next((r["forecast"] for r in _j("forecast.json")["stretches"] if r["id"] == s["id"]), None)
    hz = _by_id("hazard.json").get(s["id"])
    return {"id": s["id"], "level": s["level"], "side": s["side"], "centre_lon_lat": s["centre"],
            "retreat_m": s["retreat_m"], "land_lost_ha": s["lost_ha"], "homes_within_200m": s["homes_near"],
            "bank_position_m_by_pass": dict(zip([p["date"] for p in m["passes"]], s["history_m"])),
            "trend_forecast": fc, "ml_hazard": hz and hz["scenarios"],
            "exposure": _by_id("exposure.json").get(s["id"]), "priority": _by_id("priorities.json").get(s["id"])}


def river_outlook() -> dict:
    """Today's river level against its climatology, the 7-day trend and the forecast peak (GloFAS)."""
    o = _j("outlook.json")
    if not o:
        return {"error": "river outlook not fetched yet (python tools/fetch_outlook.py)"}
    return {"source": o["source"], "fetched_utc": o["fetched_utc"], "river": o["river"],
            "gauges": [{k: g[k] for k in ("name", "today", "trend_7d", "peak")} for g in o["gauges"]],
            "basin_rain": {k: v for k, v in o["basin_rain"].items() if k != "points"}}


def model_report() -> dict:
    """How the ML hazard model was tested and how it compares with simple baselines."""
    h = _j("hazard.json")
    return {k: h[k] for k in ("label", "model", "n_rows", "base_rate", "backtest", "backtest_without_outlook",
                              "learned_beats_baselines", "from_pass", "status")}


def plan_response(crews: int = 5, shelter: int = 500) -> dict:
    """Where crews (one 500 m stretch each) and shelter places protect the most people, by the tested planner."""
    pri = _j("priorities.json")
    return {"scenario": pri["scenario"], **pl.plan(pri["stretches"], int(crews), int(shelter))}


def alert_for(stretch_id: str, lang: str = "bn") -> dict:
    """The fixed-template alert for a stretch (never written by AI) and who receives it."""
    s = _seg_props().get(stretch_id.upper())
    if not s:
        return {"error": f"unknown stretch {stretch_id}"}
    if s["level"] not in ("red", "amber"):
        return {"error": "no alert: stretch is not red or amber"}
    return {"id": s["id"], "text": alert_text(s, _j("manifest.json")["period_days"], lang), "audience": audience(s["level"])}


def news_reports(limit: int = 20) -> dict:
    """Newspaper erosion reports used in the back-test, with their outcome (warned / late / off bank / unscorable)."""
    sc = _j("scorecard.json")
    return {"summary": sc["summary"], "events": [
        {"id": e["id"], "date": e["date"], "outcome": e["outcome"], "place": e["meta"]["place"],
         "source": e["meta"]["source_name"], "url": e["meta"]["source_url"]} for e in sc["events"][:limit]]}


TOOLS = {f.__name__: f for f in (season_summary, list_stretches, get_stretch, river_outlook, model_report,
                                 plan_response, alert_for, news_reports)}
