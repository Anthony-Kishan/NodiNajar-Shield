"""
Guardrail for the assistant: every number in an answer must appear in the
tool results or retrieved text it was given. Numbers that don't are reported as
ungrounded, and the web app shows a warning under the answer.

Small numbers (0 to 12) and years are allowed, since they are usually counts in
prose ("two passes", "12-day repeat") or dates. The same rule is implemented in
webapp/lib/grounding.ts.
"""
from __future__ import annotations

import re

NUM = re.compile(r"(?<![\w.])[-+]?\d[\d,]*(?:\.\d+)?")
BN = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")


def numbers(text: str) -> set[float]:
    out = set()
    for m in NUM.findall(text.translate(BN)):
        try:
            out.add(float(m.replace(",", "")))
        except ValueError:
            pass
    return out


def _allowed(v: float) -> bool:
    return (0 <= v <= 12 and v == int(v)) or (1900 <= v <= 2100 and v == int(v))


def check(answer: str, evidence: list[str]) -> dict:
    """Numbers in `answer` not found (to the nearest 0.1, or as a rounded integer) in the evidence."""
    ev = set()
    for e in evidence:
        for v in numbers(e):
            ev |= {round(v, 1), float(round(v)), round(abs(v), 1), float(round(abs(v)))}
            if 0 < abs(v) <= 1:  # shares written as percentages
                ev |= {round(100 * abs(v), 1), float(round(100 * abs(v)))}
    bad = sorted(v for v in numbers(answer) if not _allowed(v) and round(v, 1) not in ev and abs(round(v, 1)) not in ev)
    return {"grounded": not bad, "ungrounded": bad}
