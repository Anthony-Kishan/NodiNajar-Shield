# Use of AI in this project

The log for the earlier NodiNajar work is in the original repository (github.com/Anthony-Kishan/NodiNajar, docs/AI_USE.md). This file covers the Climate Shield build.

## Tools

| Tool | Used for |
| --- | --- |
| Claude (Anthropic), Claude Opus 5.5 in claude.ai | Read the earlier repo, wrote the build plan, wrote the new modules, tests, web pages, MCP server and docs listed below |
| Claude API (claude-sonnet-5-5 by default) | Runtime: the Ask NodiNajar assistant (tool use only; it cannot change data) |
| scikit-learn | The erosion-hazard model (gradient-boosted trees, logistic regression) |

## What the AI did (20 Nov 2026)

- Read the earlier NodiNajar repository and wrote the Climate Shield build plan (forecast, exposure, response planner, AI assistant).
- Imported the earlier work as the first commit of this repository and removed earlier-event mentions from the app.
- Wrote `src/compute/outlook.py`, `hazard.py`, `exposure.py`, `planner.py`, `src/pipeline/export_shield.py`, `tools/fetch_outlook.py`, `tools/fetch_osm_assets.py` and their tests. The model choice and every metric come from running this code, not from the AI.
- Wrote the assistant layer: `src/agent/tools.py`, `knowledge.py` (TF-IDF retrieval), `grounding.py` (number check), `mcp_server/server.py`, `webapp/app/api/assistant/route.ts`, and the Forecast, Response plan and Ask NodiNajar pages. Checked that the TypeScript planner and grounding rules give the same results as the Python ones.
- Looked up the census household size (3.98, BBS Population and Housing Census 2022, reported by BSS) and the Open-Meteo API parameters before using them.

## What the AI did not do

- No language model computes a number shown in the app. Language models only explain numbers returned by the tools, and the app flags any number in an answer that the tools did not return.
- No AI writes alert messages. Alerts are fixed templates.
- Planning inputs (crews, shelter places) are set by the user.

## Prompts

1. "This is the challenge or domain for our AI Builders Congress AI hackathon... traverse all over the repo, get the context and start planning the build. The product should not mention [the earlier event] anywhere, but it can mention NASA data resources properly." (Climate Shield track text attached.)
2. "Here are the submission criteria. We need to start building the project ASAP according to the build plan. We need to create the project on a separate GitHub repo." (Submission form screenshots attached.)
