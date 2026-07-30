from __future__ import annotations

import re

CITATION_RE = re.compile(r"\[S(\d+)\]")


def extract_citations(text: str) -> list[str]:
    return [f"S{m.group(1)}" for m in CITATION_RE.finditer(text)]


def validate_citations(text: str, valid_ids: set[str]) -> tuple[str, list[str], list[str]]:
    found = extract_citations(text)
    valid = [c for c in found if c in valid_ids]
    invalid = [c for c in found if c not in valid_ids]

    def repl(match: re.Match[str]) -> str:
        label = f"S{match.group(1)}"
        return match.group(0) if label in valid_ids else ""

    cleaned = CITATION_RE.sub(repl, text)
    # Collapse leftover double spaces from removals
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    return cleaned, sorted(set(valid)), sorted(set(invalid))
