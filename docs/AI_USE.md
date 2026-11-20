# Use of AI in this project

The log for the earlier NodiNajar work is in the original repository (github.com/Anthony-Kishan/NodiNajar, docs/AI_USE.md). This file covers the Climate Shield build.

## Tools

| Tool | Used for |
| --- | --- |
| Claude Code (Claude Opus 5.5, Anthropic), run from claude.ai | Coding agent: read the earlier repo, wrote the build plan, the new modules, tests, web pages, MCP server, docs and the demo-video renderer; delivered changes as git patches |
| Google Gemini API (gemini-2.5-flash, free tier) | Runtime: the live Ask NodiNajar assistant (function calling only; it cannot change data) |
| Claude API (claude-sonnet-5-5) | Runtime alternative: same tools, used when `ANTHROPIC_API_KEY` is set instead of `GEMINI_API_KEY` |
| ElevenLabs | Voice-over for the demo video (script written by the team with Claude) |
| scikit-learn | The erosion-hazard model (gradient-boosted trees, logistic regression) |

## What the AI did (20 Nov 2026)

- Read the earlier NodiNajar repository and wrote the Climate Shield build plan (forecast, exposure, response planner, AI assistant).
- Imported the earlier work as the first commit of this repository and removed earlier-event mentions from the app.
- Wrote `src/compute/outlook.py`, `hazard.py`, `exposure.py`, `planner.py`, `src/pipeline/export_shield.py`, `tools/fetch_outlook.py`, `tools/fetch_osm_assets.py` and their tests. The model choice and every metric come from running this code, not from the AI.
- Wrote the assistant layer: `src/agent/tools.py`, `knowledge.py` (TF-IDF retrieval), `grounding.py` (number check), `mcp_server/server.py`, `webapp/app/api/assistant/route.ts`, and the Forecast, Response plan and Ask NodiNajar pages. Checked that the TypeScript planner and grounding rules give the same results as the Python ones.
- Looked up the census household size (3.98, BBS Population and Housing Census 2022, reported by BSS) and the Open-Meteo API parameters before using them.

- Redesigned the web app ("silt & river" theme, map page, 3D view, before/after slider), fixed the response-plan buttons and the layout and contrast issues the team reported.
- Added Gemini function calling to `route.ts` next to Claude, so the assistant runs on a free key; found and fixed a deploy bug (`.vercelignore` was removing `webapp/app/api`).
- Wrote the demo-video plan and rendered the scenes in Python (Pillow + ffmpeg) from the real NISAR data and app screenshots, timed to the team's ElevenLabs voice-over.

## Checks on the AI's output

- The grounding check caught nothing wrong in most test questions, but in one Gemini test it let through "267 people" for stretch C011 (the data says 167) because 267 appears elsewhere in the evidence. We left that answer out of the video. Planned fix: match each number to the stretch it is about.
- The team reviewed every patch before `git am` and ran the builds and tests locally.

## What the AI did not do

- No language model computes a number shown in the app. Language models only explain numbers returned by the tools, and the app flags any number in an answer that the tools did not return.
- No AI writes alert messages. Alerts are fixed templates.
- Planning inputs (crews, shelter places) are set by the user.

## Prompts

1. "This is the challenge or domain for our AI Builders Congress AI hackathon... traverse all over the repo, get the context and start planning the build. The product should not mention [the earlier event] anywhere, but it can mention NASA data resources properly." (Climate Shield track text attached.)
2. "Here are the submission criteria. We need to start building the project ASAP according to the build plan. We need to create the project on a separate GitHub repo." (Submission form screenshots attached.)
3. "UI looks dull... we need an outstanding, eye-soothing UI... visuals rather than text... clean, unique." Then: "map page doesn't follow the theme... highlight the 3D viewer and comparison slider... plan buttons don't change anything... make it fully responsive... find and fix issues."
4. "I would like to use a free AI API key, which one should I select?" (led to the Gemini backend)
5. "Start creating the video... ElevenLabs voice-over... make a video plan, then start." Then: "show more usage of AI in the video."
6. "We're missing out so many scores... YouTube video criteria... try to get as much pre-judgement score." (led to the 2:46 cut in the judges' five-part order)

## Runtime system prompt

The assistant's system prompt is the `SYSTEM` constant in `webapp/app/api/assistant/route.ts`. It sets the role, and its rules are: quote numbers only from tool results, name stretch IDs, say "forecast" and "provisional", use only fixed alert templates, say when the data cannot answer, and reply in the user's language (Bangla or English). History is trimmed to the last 10 messages and the tool loop stops after 6 steps.
