# Project rules for coding agents (NodiNajar · Climate Shield)

- Science lives in src/compute. Every function there is deterministic and has a test in tests/. Run `pytest -q` before committing.
- No language model or agent may compute or invent a number shown to users; agents may explain numbers returned by src/agent/tools.py. Trained ML models in src/compute (hazard.py) are allowed when versioned, tested, back-tested against baselines and labelled as forecasts.
- Alerts are fixed templates filled from computed values. Do not generate alert text with an LLM.
- Label NISAR output "PROVISIONAL". Label synthetic output "SYNTHETIC". Never remove these labels.
- Synthetic scenes use real NISAR pass dates only (docs/COVERAGE.md). Never show a pass date that NISAR did not make.
- The web demo must work offline from web/index.html (file://). In webapp/, only /api/assistant calls an external service (Claude API); every page works without it. Fetched data (outlook, OSM) is cached as files.
- Log any AI-generated code or text in docs/AI_USE.md.
- Licence: Apache-2.0. Cite every data source in README.md.
