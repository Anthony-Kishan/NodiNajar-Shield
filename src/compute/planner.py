"""
Response planner: with limited crews and shelter places, where do they protect
the most people?

Two resources, both set by the user (they are planning inputs, not data):
  crews    teams that can place emergency geobags on one 500 m stretch each
  shelter  places in flood shelters / safe ground for evacuation

Expected people protected on a stretch = P(advance by next pass) x people in the
high-end forecast zone (or, if none are in the zone, x people in the stretch,
weighted by NEAR_WEIGHT because they are farther from the bank).
Crews go to the stretches with the highest expected value first (each crew
covers one stretch, so greedy order is optimal). Shelter places then go to the
stretches that did not get a crew, again highest expected value first. Ties are
broken by stretch id so the plan is reproducible.

The webapp runs the same rules in TypeScript (webapp/lib/planner.ts) so the
sliders respond instantly; tests/test_planner.py fixes the expected results.
"""
from __future__ import annotations

NEAR_WEIGHT = 0.25


def expected_people(s: dict) -> float:
    zone = s.get("people_in_high_zone_est") or 0
    near = s.get("people_est") or 0
    return s["p"] * (zone if zone else NEAR_WEIGHT * near)


def plan(stretches: list[dict], crews: int, shelter: int) -> dict:
    """stretches: [{"id", "p", "people_est", "people_in_high_zone_est"}]."""
    if crews < 0 or shelter < 0:
        raise ValueError("crews and shelter must be >= 0")
    ranked = sorted(stretches, key=lambda s: (-expected_people(s), s["id"]))
    actions, left = [], shelter
    for i, s in enumerate(ranked):
        ev = expected_people(s)
        if ev <= 0:
            continue
        if i < crews:
            actions.append({"id": s["id"], "action": "geobags", "expected_people": round(ev, 1)})
        elif left > 0:
            need = s.get("people_in_high_zone_est") or 0
            give = min(need, left)
            if give > 0:
                left -= give
                actions.append({"id": s["id"], "action": "evacuate", "places": give,
                                "expected_people": round(s["p"] * give, 1)})
    covered = sum(a["expected_people"] for a in actions)
    total = sum(expected_people(s) for s in stretches)
    return {"crews": crews, "shelter": shelter, "actions": actions,
            "expected_people_covered": round(covered, 1), "expected_people_total": round(total, 1),
            "share_covered": round(covered / total, 3) if total else None, "shelter_unused": left}
