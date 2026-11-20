"""
ML erosion-hazard model: the probability that a bank stretch advances at least
30 m inland by the next radar pass.

Training data is the stretch-by-pass panel the NISAR engine already measures
(src/compute/bankline.py): for every stretch and every pass k we know the bank
position, the river's water extent and the rain before the pass. The label is
whether the bank moved >= ADVANCE_M further inland by pass k+1.

Two learned models compete (scikit-learn, fixed seeds, so results are
reproducible) against three non-learned baselines:
  base_rate     always predict the share of moves seen so far
  persistence   predict a move if the last interval moved >= ADVANCE_M
  trend         the Theil-Sen trend (src/compute/forecast.py) projected 12 days
Evaluation is rolling-origin: to score pass k+1 the model is trained only on
labels known by pass k. The model that wins the back-test (lowest Brier score)
is the one shipped. If a baseline wins, the output says so.

Limits stated in the output: one monsoon, stretches that were selected because
they moved, and a bank line that partly follows the waterline (rising water
pushes it inland). The label is "the measured bank moved inland", not "land was
permanently lost".
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from src.compute.forecast import theil_sen

ADVANCE_M = 30.0
SEED = 7
MIN_K = 2  # first pass index usable as a feature row (needs two earlier intervals)

FEATURES = [
    ("last_change_m", "bank moved in the last interval (m)"),
    ("prev_change_m", "bank moved in the interval before (m)"),
    ("position_m", "bank position since the first pass (m)"),
    ("trend_m_per_12d", "Theil-Sen trend so far (m per 12 days)"),
    ("water_km2", "river water extent at this pass (km2)"),
    ("water_change_km2", "change in water extent since the last pass (km2)"),
    ("rain_mm", "rain in the 12 days before this pass (mm)"),
    ("east_bank", "east bank (1) or west bank (0)"),
    ("river_rising_next", "river forecast to rise before the next pass (1/0)"),
]
NAMES = [f for f, _ in FEATURES]
LABELS = dict(FEATURES)


@dataclass
class Row:
    stretch: str
    k: int
    x: list[float]
    y: int | None


def _days(dates: list[str]) -> list[int]:
    d0 = date.fromisoformat(dates[0])
    return [(date.fromisoformat(d) - d0).days for d in dates]


def features_at(h: list[float | None], k: int, dates: list[str], water: list[float], rain: list[float | None],
                side: str, rising_next: int) -> list[float] | None:
    """Feature vector for stretch history h at pass k, or None if a needed pass was not measured."""
    if k < MIN_K or h[k] is None or h[k - 1] is None or h[k - 2] is None:
        return None
    t = _days(dates[: k + 1])
    pts = [(ti, v) for ti, v in zip(t, h[: k + 1]) if v is not None]
    rate = theil_sen([p[0] for p in pts], [p[1] for p in pts])["slope"] * 12 if len(pts) >= 2 else 0.0
    r = rain[k] if rain and rain[k] is not None else 0.0
    return [h[k] - h[k - 1], h[k - 1] - h[k - 2], h[k], rate, water[k], water[k] - water[k - 1], r,
            1.0 if side == "east" else 0.0, float(rising_next)]


def build_panel(stretches: list[dict], dates: list[str], water: list[float], rain: list[float | None]) -> list[Row]:
    """Labelled rows for every stretch and every pass k that has a next pass."""
    rows = []
    for s in stretches:
        h = s["history_m"]
        for k in range(MIN_K, len(dates) - 1):
            x = features_at(h, k, dates, water, rain, s["side"], int(water[k + 1] > water[k]))
            if x is None or h[k + 1] is None:
                continue
            rows.append(Row(s["id"], k, x, int(h[k + 1] - h[k] >= ADVANCE_M)))
    return rows


def make_models() -> dict:
    return {
        "logistic": make_pipeline(StandardScaler(), LogisticRegression(C=0.5, max_iter=2000, random_state=SEED)),
        "gboost": HistGradientBoostingClassifier(max_depth=3, max_iter=150, learning_rate=0.05,
                                                 min_samples_leaf=8, l2_regularization=1.0, random_state=SEED),
    }


def _baseline(name: str, x: np.ndarray) -> np.ndarray:
    i_last, i_rate = NAMES.index("last_change_m"), NAMES.index("trend_m_per_12d")
    if name == "persistence":
        return (x[:, i_last] >= ADVANCE_M).astype(float)
    if name == "trend":
        return (x[:, i_rate] >= ADVANCE_M).astype(float)
    raise ValueError(name)


def _fit_predict(model, xtr: np.ndarray, ytr: np.ndarray, xte: np.ndarray) -> np.ndarray:
    if len(set(ytr.tolist())) < 2:  # one class only: predict its frequency
        return np.full(len(xte), float(ytr.mean()))
    model.fit(xtr, ytr)
    return model.predict_proba(xte)[:, 1]


def _scores(y: np.ndarray, p: np.ndarray) -> dict:
    pred = p >= 0.5
    tp = int(np.sum(pred & (y == 1)))
    fp = int(np.sum(pred & (y == 0)))
    fn = int(np.sum(~pred & (y == 1)))
    out = {
        "n": int(len(y)), "positives": int(y.sum()),
        "brier": round(float(brier_score_loss(y, p)), 4),
        "precision": round(tp / (tp + fp), 3) if tp + fp else None,
        "recall": round(tp / (tp + fn), 3) if tp + fn else None,
        "auc": None,
    }
    if 0 < y.sum() < len(y) and len(set(p.tolist())) > 1:
        out["auc"] = round(float(roc_auc_score(y, p)), 3)
    return out


def backtest(rows: list[Row], first_test_k: int, drop: tuple[str, ...] = ()) -> dict:
    """Rolling-origin back-test: for each k >= first_test_k, train on rows with index < k and score rows at k."""
    cols = [i for i, n in enumerate(NAMES) if n not in drop]
    ks = sorted({r.k for r in rows if r.k >= first_test_k})
    preds: dict[str, list[float]] = {m: [] for m in ("logistic", "gboost", "base_rate", "persistence", "trend")}
    ys: list[int] = []
    for k in ks:
        tr = [r for r in rows if r.k < k]
        te = [r for r in rows if r.k == k]
        if not tr or not te:
            continue
        xtr = np.array([r.x for r in tr])[:, cols]
        ytr = np.array([r.y for r in tr])
        xte_full = np.array([r.x for r in te])
        xte = xte_full[:, cols]
        for name, m in make_models().items():
            preds[name].extend(_fit_predict(m, xtr, ytr, xte).tolist())
        preds["base_rate"].extend([float(ytr.mean())] * len(te))
        for b in ("persistence", "trend"):
            preds[b].extend(_baseline(b, xte_full).tolist())
        ys.extend(r.y for r in te)
    y = np.array(ys)
    res = {name: _scores(y, np.array(p)) for name, p in preds.items()} if len(y) else {}
    best = min(res, key=lambda n: res[n]["brier"]) if res else None
    return {"tested_passes": ks, "models": res, "best": best, "dropped": list(drop)}


def contributions(model, x: np.ndarray, background: np.ndarray, cols: list[int]) -> list[dict]:
    """
    Per-feature effect on one prediction: probability change when that feature is
    replaced by its training median (occlusion). Deterministic and model-agnostic.
    """
    base = float(model.predict_proba(x[None, cols])[0, 1])
    med = np.median(background, axis=0)
    out = []
    for j in cols:
        z = x.copy()
        z[j] = med[j]
        delta = base - float(model.predict_proba(z[None, cols])[0, 1])
        out.append({"feature": NAMES[j], "label": LABELS[NAMES[j]], "value": round(float(x[j]), 1),
                    "effect": round(delta, 3)})
    return sorted(out, key=lambda d: -abs(d["effect"]))


def train_and_predict(stretches: list[dict], dates: list[str], water: list[float], rain: list[float | None],
                      first_test_k: int = 4) -> dict:
    """Back-test, pick the winner, retrain it on every row and score the next pass for each stretch."""
    rows = build_panel(stretches, dates, water, rain)
    if len(rows) < 20:
        raise ValueError(f"only {len(rows)} labelled rows; need at least 20")
    bt = backtest(rows, first_test_k)
    bt_no_outlook = backtest(rows, first_test_k, drop=("river_rising_next",))
    learned = {k: v for k, v in bt["models"].items() if k in ("logistic", "gboost")}
    chosen = min(learned, key=lambda n: learned[n]["brier"])
    x_all = np.array([r.x for r in rows])
    y_all = np.array([r.y for r in rows])
    cols = list(range(len(NAMES)))
    model = make_models()[chosen].fit(x_all, y_all)

    k = len(dates) - 1  # latest pass: forecast the next one
    preds = []
    for s in stretches:
        sc = {}
        for scen, rising in (("river_rising", 1), ("river_not_rising", 0)):
            x = features_at(s["history_m"], k, dates, water, rain, s["side"], rising)
            if x is None:
                sc = None
                break
            xv = np.array(x)
            sc[scen] = {"p": round(float(model.predict_proba(xv[None, :])[0, 1]), 3),
                        "drivers": contributions(model, xv, x_all, cols)[:3]}
        preds.append({"id": s["id"], "level": s.get("level"), "scenarios": sc})
    return {
        "label": f"P(bank moves >= {ADVANCE_M:g} m inland by the next pass)",
        "model": chosen, "n_rows": len(rows), "base_rate": round(float(y_all.mean()), 3),
        "features": [{"name": n, "label": LABELS[n]} for n in NAMES],
        "backtest": bt, "backtest_without_outlook": bt_no_outlook,
        "learned_beats_baselines": bt["best"] in ("logistic", "gboost"),
        "from_pass": dates[k], "stretches": preds,
    }
