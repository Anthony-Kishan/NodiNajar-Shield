"""Tests for the assistant's tools, retrieval and number-grounding guardrail."""
from src.agent import grounding as g
from src.agent import tools as T
from src.agent.knowledge import Index, build, chunk_markdown


def test_grounding_flags_invented_numbers():
    ev = ['{"retreat_m": 160.0, "homes_near": 67, "p": 0.412}']
    assert g.check("C011 moved 160 m with 67 homes nearby", ev)["grounded"]
    assert g.check("probability 41%", ev)["grounded"]  # 0.412 written as a percentage
    bad = g.check("C011 moved 185 m", ev)
    assert not bad["grounded"] and bad["ungrounded"] == [185.0]


def test_grounding_allows_small_counts_years_and_bangla_digits():
    assert g.check("two passes, 12-day repeat, in 2026", [])["grounded"]
    assert not g.check("পাড় ১৬০ মিটার", [])["grounded"]
    assert g.check("পাড় ১৬০ মিটার", ["160"])["grounded"]


def test_chunking_splits_on_headings():
    c = chunk_markdown("# A\n\npara one\n\n## B\n\npara two", "x.md")
    assert [x["title"] for x in c] == ["A", "B"]


def test_retrieval_finds_relevant_chunk():
    idx = Index(build())
    hits = idx.search("Otsu threshold water mask", 3)
    assert hits and any("Otsu" in h["text"] for h in hits)


def test_tools_read_pipeline_outputs():
    s = T.season_summary()
    assert s["n_passes"] == 8 and s["totals"]["cells_red"] == 5
    top = T.list_stretches("red", 3)
    assert top["count"] == 5 and len(top["stretches"]) == 3 and all(x["level"] == "red" for x in top["stretches"])
    one = T.get_stretch("c011")
    assert one["id"] == "C011" and one["homes_within_200m"] == 67
    assert "error" in T.get_stretch("ZZZ")
    a = T.alert_for("C011", "en")
    assert a["text"].startswith("NodiNajar alert") and "C011" in a["text"]
    p = T.plan_response(2, 0)
    assert len([x for x in p["actions"] if x["action"] == "geobags"]) == 2
