from __future__ import annotations

import re

import tiktoken

_ENCODER = tiktoken.get_encoding("cl100k_base")

SPEAKER_RE = re.compile(r"^(?:\[)?([A-Z][A-Za-z0-9 .'-]{1,40})(?:\])?:\s+")


def count_tokens(text: str) -> int:
    return len(_ENCODER.encode(text))


def chunk_transcript(
    text: str,
    target_tokens: int = 600,
    max_tokens: int = 850,
    overlap_tokens: int = 100,
) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current, current_tokens
        if current:
            chunks.append("\n\n".join(current).strip())
            current = []
            current_tokens = 0

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if para_tokens > max_tokens:
            flush()
            # Split long paragraph by sentences
            sentences = re.split(r"(?<=[.!?])\s+", para)
            buf: list[str] = []
            buf_tokens = 0
            for sent in sentences:
                st = count_tokens(sent)
                if buf and buf_tokens + st > max_tokens:
                    chunks.append(" ".join(buf).strip())
                    # overlap
                    overlap = []
                    ot = 0
                    for s in reversed(buf):
                        t = count_tokens(s)
                        if ot + t > overlap_tokens:
                            break
                        overlap.insert(0, s)
                        ot += t
                    buf = overlap
                    buf_tokens = ot
                buf.append(sent)
                buf_tokens += st
            if buf:
                chunks.append(" ".join(buf).strip())
            continue

        if current and current_tokens + para_tokens > target_tokens:
            # Prefer speaker-turn / paragraph boundary
            flush()
            if chunks and overlap_tokens > 0:
                prev = chunks[-1]
                # Approximate overlap from end of previous chunk
                words = prev.split()
                overlap_text = " ".join(words[-overlap_tokens:]) if words else ""
                if overlap_text:
                    current = [overlap_text]
                    current_tokens = count_tokens(overlap_text)

        current.append(para)
        current_tokens += para_tokens
        if current_tokens >= max_tokens:
            flush()

    flush()
    return [c for c in chunks if c]
