"""
Knowledge base for the assistant (retrieval-augmented answers about methods,
limits and the news reports). Chunks come from the project's own docs and the
ground-truth table; search is TF-IDF cosine similarity (scikit-learn), fully
local and deterministic.

    python -m src.agent.knowledge     # writes webapp/public/data/knowledge.json for the web assistant
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

ROOT = Path(__file__).resolve().parents[2]
DOCS = ["docs/METHODS.md", "docs/MODEL_CARD.md", "docs/COVERAGE.md", "README.md"]


def chunk_markdown(text: str, source: str, max_chars: int = 1200) -> list[dict]:
    """Split by headings, then by paragraphs so no chunk is longer than max_chars."""
    out, title = [], source
    for block in re.split(r"\n(?=#{1,3} )", text):
        lines = block.strip().splitlines()
        if not lines:
            continue
        if lines[0].startswith("#"):
            title = lines[0].lstrip("# ").strip()
            lines = lines[1:]
        buf = ""
        for para in "\n".join(lines).split("\n\n"):
            if buf and len(buf) + len(para) > max_chars:
                out.append({"source": source, "title": title, "text": buf.strip()})
                buf = ""
            buf += para + "\n\n"
        if buf.strip():
            out.append({"source": source, "title": title, "text": buf.strip()})
    return out


def event_chunks(path: Path) -> list[dict]:
    out = []
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            text = (f"{r['event_id']}: {r['event_type'].replace('_', ' ')} on the {r['river']} at {r['place']} "
                    f"({r['union']} {r['upazila']}, {r['district']}), event date {r['event_date']} "
                    f"({r['date_precision']}), reported {r['report_date']} by {r['source_name']}. "
                    f"Homes lost: {r['homes_lost'] or 'not stated'}. Other losses: {r['other_losses'] or 'not stated'}. "
                    f"Notes: {r['notes']}")
            out.append({"source": f"ground_truth/events.csv#{r['event_id']}", "title": r["event_id"],
                        "text": text, "url": r["source_url"]})
    return out


def build(root: Path = ROOT) -> list[dict]:
    chunks = []
    for d in DOCS:
        p = root / d
        if p.exists():
            chunks += chunk_markdown(p.read_text(encoding="utf-8"), d)
    chunks += event_chunks(root / "ground_truth" / "events.csv")
    for i, c in enumerate(chunks):
        c["id"] = i
    return chunks


class Index:
    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.vec = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True, stop_words="english")
        self.m = self.vec.fit_transform([f"{c['title']} {c['text']}" for c in chunks])

    def search(self, query: str, k: int = 4) -> list[dict]:
        s = cosine_similarity(self.vec.transform([query]), self.m)[0]
        top = sorted(range(len(s)), key=lambda i: (-s[i], i))[:k]
        return [{**self.chunks[i], "score": round(float(s[i]), 3)} for i in top if s[i] > 0]


def main() -> None:
    chunks = build()
    out = ROOT / "webapp" / "public" / "data" / "knowledge.json"
    out.write_text(json.dumps({"chunks": chunks}, ensure_ascii=False))
    print(f"{len(chunks)} chunks -> {out}")


if __name__ == "__main__":
    main()
