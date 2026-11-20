# Model card: erosion-hazard model

## What it predicts

For each 500 m bank stretch, the probability that the measured outer bank moves at least 30 m further inland by the next NISAR pass (about 12 days). Code: `src/compute/hazard.py`. Outputs: `webapp/public/data/hazard.json`.

## Training data

The stretch-by-pass panel from our NISAR engine (`src/compute/bankline.py`), Jamuna at Sirajganj, 8 passes from 18 June to 22 September 2026, 38 stretches the engine flagged red or amber. A row is a stretch at pass k with two earlier measured passes; the label is the bank change from pass k to pass k+1. 82 labelled rows; 40.2% of them are moves of 30 m or more.

Features (all known at pass k, except the last, which comes from the river outlook in operation):

| Feature | Meaning |
| --- | --- |
| last_change_m | bank movement in the last interval |
| prev_change_m | bank movement in the interval before |
| position_m | bank position since the first pass |
| trend_m_per_12d | Theil-Sen trend of the stretch so far |
| water_km2 | river water extent in the box at pass k |
| water_change_km2 | change in water extent since the last pass |
| rain_mm | NASA POWER rain in the 12 days before pass k |
| east_bank | east (1) or west (0) bank |
| river_rising_next | river rises before the next pass (in the back-test: measured water extent; in operation: GloFAS 7-day trend) |

## Models compared

Two learned models (scikit-learn, fixed seed 7): logistic regression with scaling, and gradient-boosted trees (depth 3, 150 iterations). Three baselines with no learning: the share of moves seen so far (base rate), "the last interval repeats" (persistence) and our earlier Theil-Sen trend.

## Back-test

Rolling origin: to score pass k+1 a model is trained only on labels known by pass k. Scored passes: 29 August, 10 September and 22 September (49 rows, 18 moves).

| Model | Brier (lower is better) | AUC | Precision at 0.5 | Recall at 0.5 |
| --- | --- | --- | --- | --- |
| **Gradient-boosted trees** | **0.190** | **0.682** | 0.833 | 0.556 |
| Logistic regression | 0.207 | 0.634 | 0.714 | 0.556 |
| Base rate | 0.263 | n/a | n/a | n/a |
| Trend (Theil-Sen) | 0.367 | 0.512 | 0.500 | 0.056 |
| Persistence | 0.653 | 0.332 | 0.208 | 0.278 |

Without the river-outlook feature, the gradient-boosted model scores Brier 0.196 and AUC 0.677: the outlook helps a little. The shipped model is the gradient-boosted one, retrained on all 82 rows.

Per-stretch explanations: for each prediction, the change in probability when one feature is replaced by its training median (occlusion). The three largest effects are shown as the stretch's drivers.

## Limits (read before using)

- **Small sample.** 49 scored rows from one monsoon. The AUC of 0.68 has a wide uncertainty; treat the ranking as a triage aid, not a calibrated probability.
- **Selection.** The 38 stretches were chosen because they moved, so the base rate is far higher than for the whole river.
- **Waterline effect.** The measured bank partly follows the water: rising water moves it inland, falling water moves it back (see "Why it moves"). The label is "the measured bank moved inland", not "land was permanently lost".
- **Provisional radar.** NISAR products are provisional.
- **Next step.** Train on multi-year Sentinel-1 bank lines (2016 onward) run through the same engine, then test on NISAR 2026 as an independent year.

## Rules

The model is deterministic, tested (`tests/test_shield.py`) and versioned with the code. Language models never compute or change these numbers. Alerts stay fixed templates.
