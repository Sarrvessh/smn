"""Helpers to keep assistant answers readable as Markdown."""

from __future__ import annotations

import re

_SECTION_RE = re.compile(
    r"(?im)^(?:#{1,3}\s*)?(Direct\s+answer|Key\s+insights|Practical\s+recommendation|Sources)\s*:?\s*(.*)$"
)

_CANONICAL = {
    "direct answer": "Direct answer",
    "key insights": "Key insights",
    "practical recommendation": "Practical recommendation",
    "sources": "Sources",
}


def normalize_qa_markdown(text: str) -> str:
    """Repair common local-model Markdown collapses into readable sections."""
    if not text or not text.strip():
        return text

    out = text.replace("\r\n", "\n").strip()

    # Ensure ATX headings start on their own line
    out = re.sub(r"(?<!\n)(#{1,3}\s+)", r"\n\n\1", out)

    lines: list[str] = []
    for line in out.split("\n"):
        m = _SECTION_RE.match(line.strip())
        if m:
            title = _CANONICAL[re.sub(r"\s+", " ", m.group(1).lower())]
            rest = (m.group(2) or "").strip()
            lines.append(f"### {title}")
            lines.append("")
            if rest:
                lines.append(rest)
        else:
            lines.append(line)
    out = "\n".join(lines)

    # Put jammed list markers on new lines
    out = re.sub(r"([.:;])\s+(-\s+\*\*)", r"\1\n\n\2", out)
    out = re.sub(r"([^\n])\s+(-\s+)", r"\1\n\2", out)

    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip() + "\n"
