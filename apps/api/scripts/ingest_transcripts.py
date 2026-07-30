"""Ingest Lenny podcast transcripts into Postgres + pgvector."""

from __future__ import annotations

import argparse
import asyncio
import atexit
import json
import os
import sys
from pathlib import Path

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.ingestion.pipeline import IngestionPipeline

LOCK_PATH = Path(__file__).resolve().parents[2] / ".ingest.lock"


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        import ctypes

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
        handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid)
        if handle:
            kernel32.CloseHandle(handle)
            return True
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def _release_lock() -> None:
    try:
        if LOCK_PATH.exists() and LOCK_PATH.read_text(encoding="utf-8").strip() == str(os.getpid()):
            LOCK_PATH.unlink(missing_ok=True)
    except OSError:
        pass


def _acquire_lock() -> bool:
    if LOCK_PATH.exists():
        try:
            old_pid = int(LOCK_PATH.read_text(encoding="utf-8").strip())
        except ValueError:
            old_pid = None
        if old_pid and _pid_alive(old_pid):
            print(f"Another ingest is running (pid={old_pid}). Exiting.", file=sys.stderr, flush=True)
            return False
    LOCK_PATH.write_text(str(os.getpid()), encoding="utf-8")
    atexit.register(_release_lock)
    return True


async def _run(source: Path | None, incremental: bool, limit: int | None = None) -> dict:
    async with AsyncSessionLocal() as session:
        pipeline = IngestionPipeline(session)
        return await pipeline.run(source=source, incremental=incremental, limit=limit)


def main() -> int:
    if not _acquire_lock():
        return 2
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=None)
    parser.add_argument("--incremental", action="store_true", default=True)
    parser.add_argument("--full", action="store_true", help="Re-ingest all episodes")
    parser.add_argument("--limit", type=int, default=None, help="Ingest at most N episodes")
    args = parser.parse_args()
    incremental = not args.full
    settings = get_settings()
    source = args.source or settings.corpus_dir
    if not source.exists():
        print(f"Corpus not found at {source}. Run: python -m scripts.corpus", file=sys.stderr)
        return 1
    print(f"[ingest] start pid={os.getpid()} source={source} incremental={incremental}", flush=True)
    report = asyncio.run(_run(source, incremental, args.limit))
    print(json.dumps(report, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
