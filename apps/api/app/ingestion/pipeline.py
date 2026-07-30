from __future__ import annotations

import hashlib
import json
import logging
import time
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import EMBEDDING_DIMENSION_MISMATCH, AppError
from app.db.models import Episode, MessageSource, TranscriptChunk
from app.ingestion.chunker import chunk_transcript, count_tokens
from app.ingestion.parser import discover_transcripts, parse_transcript
from app.llm.registry import registry

logger = logging.getLogger(__name__)


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _json_safe(value: Any) -> Any:
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_safe(v) for v in value]
    return value


def _parse_duration(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _parse_date(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


class IngestionPipeline:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.settings = get_settings()
        self.embedder = registry.get_embeddings()

    async def run(
        self,
        source: Path | None = None,
        incremental: bool = True,
        limit: int | None = None,
    ) -> dict[str, Any]:
        started = time.time()
        corpus = source or self.settings.corpus_dir
        files = discover_transcripts(corpus)
        if limit is not None:
            files = files[:limit]
        report: dict[str, Any] = {
            "episodes_discovered": len(files),
            "episodes_inserted": 0,
            "episodes_updated": 0,
            "episodes_skipped": 0,
            "chunks_generated": 0,
            "embedding_failures": 0,
            "total_duration": 0,
        }

        if not files:
            report["total_duration"] = round(time.time() - started, 2)
            return report

        # Detect embedding dimension
        sample = await self.embedder.embed_query("dimension check")
        dim = len(sample)
        if dim != self.settings.embedding_dim:
            raise AppError(
                EMBEDDING_DIMENSION_MISMATCH,
                f"Embedding dim {dim} != EMBEDDING_DIM {self.settings.embedding_dim}",
                retryable=False,
                status_code=500,
            )

        total_files = len(files)
        for file_i, path in enumerate(files, start=1):
            try:
                meta, body, slug = parse_transcript(path)
                source_h = content_hash(body)
                # Avoid stale identity-map misses after prior commits/rollbacks
                self.session.expire_all()
                existing = (
                    await self.session.execute(select(Episode).where(Episode.slug == slug))
                ).scalar_one_or_none()

                if incremental and existing and existing.source_hash == source_h:
                    report["episodes_skipped"] += 1
                    if file_i % 25 == 0 or file_i == total_files:
                        print(
                            f"[ingest] {file_i}/{total_files} skipped={report['episodes_skipped']} "
                            f"inserted={report['episodes_inserted']} updated={report['episodes_updated']}",
                            flush=True,
                        )
                    continue

                chunks = chunk_transcript(body)
                embeddings: list[list[float]] = []
                batch_size = 8
                for i in range(0, len(chunks), batch_size):
                    batch = chunks[i : i + batch_size]
                    try:
                        embeddings.extend(await self.embedder.embed_documents(batch))
                    except Exception:  # noqa: BLE001
                        try:
                            embeddings.extend(await self.embedder.embed_documents(batch))
                        except Exception:  # noqa: BLE001
                            report["embedding_failures"] += len(batch)
                            embeddings.extend([[0.0] * dim] * len(batch))

                if existing is None:
                    # Race-safe: re-check once more before insert
                    existing = (
                        await self.session.execute(select(Episode).where(Episode.slug == slug))
                    ).scalar_one_or_none()

                if existing:
                    await self.session.execute(
                        delete(MessageSource).where(
                            MessageSource.chunk_id.in_(
                                select(TranscriptChunk.id).where(
                                    TranscriptChunk.episode_id == existing.id
                                )
                            )
                        )
                    )
                    await self.session.execute(
                        delete(TranscriptChunk).where(TranscriptChunk.episode_id == existing.id)
                    )
                    existing.guest = meta["guest"]
                    existing.title = meta["title"]
                    existing.description = meta.get("description")
                    existing.publish_date = _parse_date(meta.get("publish_date"))
                    existing.youtube_url = meta.get("youtube_url")
                    existing.duration_seconds = _parse_duration(meta.get("duration_seconds"))
                    existing.source_hash = source_h
                    existing.metadata_ = _json_safe(
                        {k: v for k, v in meta.items() if k not in {"guest", "title"}}
                    )
                    episode = existing
                    report["episodes_updated"] += 1
                else:
                    episode = Episode(
                        id=uuid4(),
                        slug=slug,
                        guest=meta["guest"],
                        title=meta["title"],
                        description=meta.get("description"),
                        publish_date=_parse_date(meta.get("publish_date")),
                        youtube_url=meta.get("youtube_url"),
                        duration_seconds=_parse_duration(meta.get("duration_seconds")),
                        source_hash=source_h,
                        metadata_=_json_safe(
                            {k: v for k, v in meta.items() if k not in {"guest", "title"}}
                        ),
                    )
                    self.session.add(episode)
                    await self.session.flush()
                    report["episodes_inserted"] += 1

                for idx, (chunk_text, emb) in enumerate(zip(chunks, embeddings, strict=False)):
                    ch = TranscriptChunk(
                        id=uuid4(),
                        episode_id=episode.id,
                        chunk_index=idx,
                        content=chunk_text,
                        token_count=count_tokens(chunk_text),
                        embedding=emb,
                        content_hash=content_hash(chunk_text),
                        metadata_={},
                    )
                    self.session.add(ch)
                    report["chunks_generated"] += 1

                await self.session.flush()
                await self.session.execute(
                    text(
                        "UPDATE transcript_chunks SET search_vector = "
                        "to_tsvector('english', coalesce(content, '')) "
                        "WHERE episode_id = :eid"
                    ),
                    {"eid": str(episode.id)},
                )
                await self.session.commit()
                print(
                    f"[ingest] {file_i}/{total_files} ok slug={slug} "
                    f"chunks={len(chunks)} inserted={report['episodes_inserted']} "
                    f"updated={report['episodes_updated']}",
                    flush=True,
                )
            except Exception:
                await self.session.rollback()
                logger.exception("Failed ingesting %s", path)
                raise

        # Ensure HNSW index exists (idempotent)
        await self.session.execute(
            text(
                """
                DO $$ BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE indexname = 'ix_chunks_embedding_hnsw'
                  ) THEN
                    CREATE INDEX ix_chunks_embedding_hnsw ON transcript_chunks
                    USING hnsw (embedding vector_cosine_ops);
                  END IF;
                END $$;
                """
            )
        )
        await self.session.commit()

        report["total_duration"] = round(time.time() - started, 2)
        out_dir = Path(__file__).resolve().parents[4] / "docs" / "ingestion-reports"
        out_dir.mkdir(parents=True, exist_ok=True)
        stamp = datetime.now(UTC).strftime("%Y%m%d-%H%M%S")
        (out_dir / f"ingest-{stamp}.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
        return report


async def knowledge_status(session: AsyncSession) -> dict[str, Any]:
    episodes = (await session.execute(select(func.count()).select_from(Episode))).scalar_one()
    chunks = (await session.execute(select(func.count()).select_from(TranscriptChunk))).scalar_one()
    settings = get_settings()
    return {
        "episodes": episodes,
        "chunks": chunks,
        "ready": chunks > 0,
        "embedding_dim": settings.embedding_dim if chunks else None,
    }
