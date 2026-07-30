from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.llm.registry import registry


@dataclass
class RetrievedChunk:
    chunk_id: UUID
    episode_id: UUID
    content: str
    guest: str
    episode_title: str
    source_url: str | None
    publish_date: str | None
    vector_rank: int | None = None
    vector_score: float | None = None
    keyword_rank: int | None = None
    keyword_score: float | None = None
    combined_score: float = 0.0
    citation_label: str = ""


async def vector_search(session: AsyncSession, query_embedding: list[float], limit: int) -> list[RetrievedChunk]:
    sql = text(
        """
        SELECT c.id AS chunk_id, c.episode_id, c.content,
               e.guest, e.title AS episode_title, e.youtube_url, e.publish_date,
               1 - (c.embedding <=> :embedding) AS score
        FROM transcript_chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.embedding IS NOT NULL
        ORDER BY c.embedding <=> :embedding
        LIMIT :limit
        """
    )
    rows = (
        await session.execute(
            sql,
            {"embedding": str(query_embedding), "limit": limit},
        )
    ).mappings().all()
    results: list[RetrievedChunk] = []
    for i, row in enumerate(rows, start=1):
        results.append(
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                episode_id=row["episode_id"],
                content=row["content"],
                guest=row["guest"],
                episode_title=row["episode_title"],
                source_url=row["youtube_url"],
                publish_date=str(row["publish_date"]) if row["publish_date"] else None,
                vector_rank=i,
                vector_score=float(row["score"]) if row["score"] is not None else None,
            )
        )
    return results


async def keyword_search(session: AsyncSession, query: str, limit: int) -> list[RetrievedChunk]:
    sql = text(
        """
        SELECT c.id AS chunk_id, c.episode_id, c.content,
               e.guest, e.title AS episode_title, e.youtube_url, e.publish_date,
               ts_rank_cd(c.search_vector, plainto_tsquery('english', :q)) AS score
        FROM transcript_chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.search_vector @@ plainto_tsquery('english', :q)
        ORDER BY score DESC
        LIMIT :limit
        """
    )
    rows = (await session.execute(sql, {"q": query, "limit": limit})).mappings().all()
    results: list[RetrievedChunk] = []
    for i, row in enumerate(rows, start=1):
        results.append(
            RetrievedChunk(
                chunk_id=row["chunk_id"],
                episode_id=row["episode_id"],
                content=row["content"],
                guest=row["guest"],
                episode_title=row["episode_title"],
                source_url=row["youtube_url"],
                publish_date=str(row["publish_date"]) if row["publish_date"] else None,
                keyword_rank=i,
                keyword_score=float(row["score"]) if row["score"] is not None else None,
            )
        )
    return results


def reciprocal_rank_fusion(
    vector_hits: list[RetrievedChunk],
    keyword_hits: list[RetrievedChunk],
    k: int = 60,
) -> list[RetrievedChunk]:
    by_id: dict[UUID, RetrievedChunk] = {}
    for hit in vector_hits:
        by_id[hit.chunk_id] = hit
        hit.combined_score += 1.0 / (k + (hit.vector_rank or 999))
    for hit in keyword_hits:
        if hit.chunk_id in by_id:
            existing = by_id[hit.chunk_id]
            existing.keyword_rank = hit.keyword_rank
            existing.keyword_score = hit.keyword_score
            existing.combined_score += 1.0 / (k + (hit.keyword_rank or 999))
        else:
            hit.combined_score += 1.0 / (k + (hit.keyword_rank or 999))
            by_id[hit.chunk_id] = hit
    return sorted(by_id.values(), key=lambda c: c.combined_score, reverse=True)


def apply_diversity(chunks: list[RetrievedChunk], max_per_episode: int, final_n: int) -> list[RetrievedChunk]:
    counts: dict[UUID, int] = {}
    selected: list[RetrievedChunk] = []
    for chunk in chunks:
        n = counts.get(chunk.episode_id, 0)
        if n >= max_per_episode:
            continue
        counts[chunk.episode_id] = n + 1
        selected.append(chunk)
        if len(selected) >= final_n:
            break
    return selected


def format_evidence(chunks: list[RetrievedChunk]) -> str:
    parts: list[str] = []
    for i, c in enumerate(chunks, start=1):
        c.citation_label = f"S{i}"
        parts.append(
            f"[{c.citation_label}]\n"
            f"Guest: {c.guest}\n"
            f"Episode: {c.episode_title}\n"
            f"Published: {c.publish_date or 'unknown'}\n"
            f"Source: {c.source_url or 'n/a'}\n"
            f"Passage:\n{c.content}\n"
        )
    return "\n".join(parts)


def to_source_payload(chunks: list[RetrievedChunk]) -> list[dict]:
    return [
        {
            "id": c.citation_label or f"S{i}",
            "guest": c.guest,
            "episode": c.episode_title,
            "excerpt": c.content[:400] + ("…" if len(c.content) > 400 else ""),
            "url": c.source_url,
            "publish_date": c.publish_date,
            "chunk_id": str(c.chunk_id),
            "score": c.combined_score,
            "vector_score": c.vector_score,
            "keyword_rank": c.keyword_rank,
        }
        for i, c in enumerate(chunks, start=1)
    ]


async def hybrid_retrieve(session: AsyncSession, query: str) -> list[RetrievedChunk]:
    settings = get_settings()
    embedder = registry.get_embeddings()
    query_vec = await embedder.embed_query(query)
    vector_hits = await vector_search(session, query_vec, settings.rag_vector_candidates)
    keyword_hits = await keyword_search(session, query, settings.rag_keyword_candidates)
    fused = reciprocal_rank_fusion(vector_hits, keyword_hits, settings.rag_fusion_constant)
    selected = apply_diversity(fused, settings.rag_max_chunks_per_episode, settings.rag_final_chunks)
    format_evidence(selected)  # assigns labels
    return selected


def should_abstain(chunks: list[RetrievedChunk]) -> bool:
    """Abstain only when evidence is empty or clearly irrelevant."""
    if not chunks:
        return True
    best_vector = max((c.vector_score or 0.0) for c in chunks)
    has_keyword = any(c.keyword_rank is not None for c in chunks)
    if has_keyword:
        return False
    if best_vector < 0.25:
        return True
    return False
