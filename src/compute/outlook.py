"""
River outlook: is the Jamuna about to rise, and how unusual is the level?

Input is a daily river discharge series (m3/s) from the Copernicus Emergency
Management Service GloFAS v4 model, served by the Open-Meteo Flood API, plus a
long history of the same cell for the climatology. Everything here is
deterministic arithmetic on that series; no model is trained.

NISAR passes come every 12 days. This module gives a daily, 1 to 30 day view
between passes, so a stretch that the radar already shows moving can be
escalated when the river is forecast to rise.
"""
from __future__ import annotations

from datetime import date, timedelta
from statistics import median

import numpy as np

# Percentile bands of the day-of-year climatology
BANDS = ((90.0, "very high"), (75.0, "high"), (25.0, "normal"), (0.0, "low"))
TREND_PCT = 5.0  # % change over the trend window that counts as rising or falling


def _doy_distance(a: date, b: date) -> int:
    """Days between two dates' day-of-year, wrapping around the year end."""
    d = abs(a.timetuple().tm_yday - b.timetuple().tm_yday)
    return min(d, 365 - d)


def climatology(history: dict[str, float], day: str, window: int = 7, exclude_year: int | None = None) -> np.ndarray:
    """All historical values within +-window days of `day`'s day-of-year (optionally leaving one year out)."""
    t = date.fromisoformat(day)
    vals = [v for d, v in history.items() if v is not None
            and (exclude_year is None or int(d[:4]) != exclude_year)
            and _doy_distance(date.fromisoformat(d), t) <= window]
    return np.asarray(vals, dtype=float)


def percentile_rank(sample: np.ndarray, value: float) -> float | None:
    """Share of the sample at or below `value`, in percent (None if the sample is empty)."""
    if sample.size == 0:
        return None
    return round(100.0 * float(np.mean(sample <= value)), 1)


def band(pct: float | None) -> str:
    if pct is None:
        return "unknown"
    for lo, name in BANDS:
        if pct >= lo:
            return name
    return "low"


def trend(values: list[float], days: int = 7) -> dict:
    """Rising / steady / falling from the first value to the value `days` later (or the last one)."""
    if len(values) < 2:
        return {"trend": "unknown", "change_pct": None}
    a, b = values[0], values[min(days, len(values) - 1)]
    pct = 100.0 * (b - a) / a if a else 0.0
    t = "rising" if pct > TREND_PCT else "falling" if pct < -TREND_PCT else "steady"
    return {"trend": t, "change_pct": round(pct, 1)}


def outlook(series: list[dict], history: dict[str, float], today: str, window: int = 7) -> dict:
    """
    series: [{"date": "YYYY-MM-DD", "q": m3/s, "q_p25": ..., "q_p75": ...}, ...] covering past and forecast days.
    history: {"YYYY-MM-DD": m3/s} long reanalysis record for the same cell (climatology).
    Returns today's level against the climatology, the trend over the next 7 days,
    the forecast peak, and a per-day table.
    """
    rows = sorted((r for r in series if r.get("q") is not None), key=lambda r: r["date"])
    if not rows:
        raise ValueError("empty discharge series")
    year = int(today[:4])
    out_days = []
    for r in rows:
        clim = climatology(history, r["date"], window, exclude_year=year)
        pct = percentile_rank(clim, r["q"])
        out_days.append({
            "date": r["date"], "q": round(r["q"], 1),
            "q_p25": None if r.get("q_p25") is None else round(r["q_p25"], 1),
            "q_p75": None if r.get("q_p75") is None else round(r["q_p75"], 1),
            "clim_p50": round(float(np.median(clim)), 1) if clim.size else None,
            "clim_p90": round(float(np.percentile(clim, 90)), 1) if clim.size else None,
            "pct": pct, "band": band(pct), "forecast": r["date"] > today,
        })
    now = next((d for d in reversed(out_days) if d["date"] <= today), out_days[0])
    ahead = [d for d in out_days if d["date"] >= now["date"]]
    tr = trend([d["q"] for d in ahead], 7)
    peak = max(ahead, key=lambda d: d["q"])
    return {
        "today": now, "trend_7d": tr,
        "peak": {"date": peak["date"], "q": peak["q"], "band": peak["band"],
                 "days_ahead": (date.fromisoformat(peak["date"]) - date.fromisoformat(now["date"])).days},
        "days": out_days,
    }


def basin_rain(points: list[dict]) -> dict:
    """Median and max of the forecast rain totals over the basin points: [{"name", "total_mm"}]."""
    tot = [p["total_mm"] for p in points if p.get("total_mm") is not None]
    if not tot:
        return {"median_mm": None, "max_mm": None, "wettest": None}
    w = max(points, key=lambda p: p.get("total_mm") or -1)
    return {"median_mm": round(median(tot), 1), "max_mm": round(max(tot), 1), "wettest": w["name"]}


def escalate(level: str, river_trend: str, river_band: str) -> dict:
    """
    Combine a stretch's radar level with the river outlook into an action priority.
      red                                   -> act now
      amber + river rising or high/very high -> act now (escalated)
      amber otherwise                       -> watch
      green                                 -> routine
    """
    if level == "red":
        return {"priority": "act now", "escalated": False}
    if level == "amber":
        if river_trend == "rising" or river_band in ("high", "very high"):
            return {"priority": "act now", "escalated": True}
        return {"priority": "watch", "escalated": False}
    return {"priority": "routine", "escalated": False}


def dates_between(start: str, end: str) -> list[str]:
    a, b = date.fromisoformat(start), date.fromisoformat(end)
    return [(a + timedelta(days=k)).isoformat() for k in range((b - a).days + 1)]
