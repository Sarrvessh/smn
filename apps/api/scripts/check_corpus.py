"""Parse and chunk the entire local transcript corpus without touching the database."""

from __future__ import annotations

import json

from app.core.config import get_settings
from app.ingestion.chunker import chunk_transcript, count_tokens
from app.ingestion.parser import discover_transcripts, parse_transcript


def main() -> int:
    files = discover_transcripts(get_settings().corpus_dir)
    empty: list[str] = []
    errors: list[dict[str, str]] = []
    total_chunks = 0
    max_chunk_tokens = 0

    for path in files:
        try:
            _meta, body, slug = parse_transcript(path)
            if not body.strip():
                empty.append(slug)
                continue
            chunks = chunk_transcript(body)
            total_chunks += len(chunks)
            if chunks:
                max_chunk_tokens = max(
                    max_chunk_tokens,
                    max(count_tokens(chunk) for chunk in chunks),
                )
        except Exception as exc:  # noqa: BLE001
            errors.append({"path": str(path), "error": str(exc)})

    report = {
        "transcript_files": len(files),
        "empty_transcripts": len(empty),
        "parse_errors": len(errors),
        "generated_chunks": total_chunks,
        "max_chunk_tokens": max_chunk_tokens,
    }
    print(json.dumps(report, indent=2))
    if not files or empty or errors:
        if empty:
            print("Empty transcript examples:", ", ".join(empty[:5]))
        if errors:
            print("Parse error examples:", json.dumps(errors[:3], indent=2))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
