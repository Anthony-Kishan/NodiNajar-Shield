"""
NodiNajar MCP server: lets any MCP client (Claude Desktop, Claude Code, an
agent framework) query the river results, the ML hazard model, the river
outlook, the response planner and the fixed-template alerts.

Run (stdio):    python -m mcp_server.server
Claude Desktop config (claude_desktop_config.json):
  {"mcpServers": {"nodinajar": {"command": "python", "args": ["-m", "mcp_server.server"],
                                "cwd": "/path/to/NodiNajar-Shield"}}}
HTTP:           python -m mcp_server.server --http      (streamable HTTP on :8765/mcp)

All tools are read-only. Numbers come from the tested pipeline outputs.
"""
from __future__ import annotations

import sys

try:  # MCP Python SDK 2.x
    from mcp.server.mcpserver import MCPServer as _Server
except ImportError:  # SDK 1.x
    from mcp.server.fastmcp import FastMCP as _Server

from src.agent import tools as T
from src.agent.knowledge import Index, build

INSTRUCTIONS = (
    "NodiNajar measures Jamuna riverbank movement in Sirajganj, Bangladesh, from NASA-ISRO NISAR L-band radar "
    "(provisional data), forecasts which 500 m stretches will move next with a back-tested ML model, adds a daily "
    "GloFAS river outlook, counts homes and people in the way, and plans where crews and shelter places help most. "
    "Quote numbers only from tool results, give stretch IDs, and say when data is provisional or a forecast. "
    "Alerts are fixed templates from alert_for; never write alert text yourself."
)

mcp = _Server("nodinajar", instructions=INSTRUCTIONS)
_index: Index | None = None


def _idx() -> Index:
    global _index
    if _index is None:
        _index = Index(build())
    return _index


@mcp.tool()
def season_summary() -> dict:
    """Season totals (stretches at risk, land lost, homes near the new bank), pass dates and data status."""
    return T.season_summary()


@mcp.tool()
def list_stretches(level: str | None = None, limit: int = 10) -> dict:
    """Bank stretches ranked by priority. level: 'red' or 'amber' (optional). limit: 1-50."""
    return T.list_stretches(level, limit)


@mcp.tool()
def get_stretch(stretch_id: str) -> dict:
    """All data for one 500 m stretch (e.g. 'C011'): measured movement, forecast, ML hazard, exposure, priority."""
    return T.get_stretch(stretch_id)


@mcp.tool()
def river_outlook() -> dict:
    """Jamuna river level vs climatology, 7-day trend and forecast peak (Copernicus GloFAS), basin rain (NOAA GFS)."""
    return T.river_outlook()


@mcp.tool()
def model_report() -> dict:
    """ML hazard model: back-test against baselines (Brier, AUC, precision, recall), with and without the outlook."""
    return T.model_report()


@mcp.tool()
def plan_response(crews: int = 5, shelter: int = 500) -> dict:
    """Allocate geobag crews (one stretch each) and shelter places to protect the most people (deterministic planner)."""
    return T.plan_response(crews, shelter)


@mcp.tool()
def alert_for(stretch_id: str, lang: str = "bn") -> dict:
    """The official fixed-template alert for a stretch, in Bangla ('bn') or English ('en'), and its recipients."""
    return T.alert_for(stretch_id, lang)


@mcp.tool()
def news_reports(limit: int = 20) -> dict:
    """Newspaper erosion reports from 2026 and whether the system warned before them."""
    return T.news_reports(limit)


@mcp.tool()
def search_knowledge(query: str, k: int = 4) -> dict:
    """Search the methods, model card, coverage notes and news reports (TF-IDF retrieval). Returns cited chunks."""
    return {"results": _idx().search(query, k)}


def main() -> None:
    if "--http" in sys.argv:
        mcp.run(transport="streamable-http")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
