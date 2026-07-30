from __future__ import annotations

from pathlib import Path
from typing import Any

import frontmatter


def discover_transcripts(corpus_dir: Path) -> list[Path]:
    episodes = corpus_dir / "episodes"
    if not episodes.exists():
        return []
    return sorted(episodes.glob("*/transcript.md"))


def parse_transcript(path: Path) -> tuple[dict[str, Any], str, str]:
    post = frontmatter.load(path)
    meta = dict(post.metadata or {})
    guest = str(meta.get("guest") or path.parent.name).strip()
    title = str(meta.get("title") or f"Episode with {guest}").strip()
    meta["guest"] = guest
    meta["title"] = title
    slug = path.parent.name
    body = normalize_content(str(post.content or ""))
    return meta, body, slug


def normalize_content(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [line.rstrip() for line in text.split("\n")]
    # Collapse 3+ blank lines
    out: list[str] = []
    blank = 0
    for line in lines:
        if not line.strip():
            blank += 1
            if blank <= 2:
                out.append("")
        else:
            blank = 0
            out.append(line)
    return "\n".join(out).strip() + "\n"
