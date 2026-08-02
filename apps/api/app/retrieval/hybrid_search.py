from __future__ import annotations

import re
from dataclasses import dataclass, field
from uuid import UUID

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.llm.registry import registry

VECTOR_ABSTAIN_THRESHOLD = 0.25

COMPARISON_CUES = re.compile(
    r"\b(compare|comparison|versus|vs\.?|across|differ|disagree|contrast|both|between)\b",
    re.IGNORECASE,
)
FOLLOWUP_CUES = re.compile(
    r"\b(what else|more about|they|them|he|she|that guest|same guest|continue|also)\b",
    re.IGNORECASE,
)
EPISODE_NUM_RE = re.compile(
    r"(?:podcast|episode)\s*(?:number|no\.?|#)?\s*(\d+)|#\s*(\d+)",
    re.IGNORECASE,
)


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


@dataclass
class EpisodeRef:
    id: UUID
    guest: str
    title: str
    slug: str


@dataclass
class RetrievalPlan:
    queries: list[str]
    episode_ids: list[UUID] | None = None
    guests: list[str] = field(default_factory=list)
    intent: str = "direct"  # direct | comparison | scoped_episode | followup
    scoped_missing: bool = False  # True when user asked for a specific episode that does not exist


def _episode_filter_sql(episode_ids: list[UUID] | None) -> str:
    if not episode_ids:
        return ""
    return " AND e.id IN :episode_ids"


def _bind_search_sql(sql_str: str, episode_ids: list[UUID] | None):
    stmt = text(sql_str)
    if episode_ids:
        stmt = stmt.bindparams(bindparam("episode_ids", expanding=True))
    return stmt


async def vector_search(
    session: AsyncSession,
    query_embedding: list[float],
    limit: int,
    episode_ids: list[UUID] | None = None,
) -> list[RetrievedChunk]:
    sql = _bind_search_sql(
        f"""
        SELECT c.id AS chunk_id, c.episode_id, c.content,
               e.guest, e.title AS episode_title, e.youtube_url, e.publish_date,
               1 - (c.embedding <=> :embedding) AS score
        FROM transcript_chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.embedding IS NOT NULL
        {_episode_filter_sql(episode_ids)}
        ORDER BY c.embedding <=> :embedding
        LIMIT :limit
        """,
        episode_ids,
    )
    params: dict = {
        "embedding": str(query_embedding),
        "limit": limit,
    }
    if episode_ids:
        params["episode_ids"] = list(episode_ids)
    rows = (await session.execute(sql, params)).mappings().all()
    return [
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
        for i, row in enumerate(rows, start=1)
    ]


async def keyword_search(
    session: AsyncSession,
    query: str,
    limit: int,
    episode_ids: list[UUID] | None = None,
) -> list[RetrievedChunk]:
    sql = _bind_search_sql(
        f"""
        SELECT c.id AS chunk_id, c.episode_id, c.content,
               e.guest, e.title AS episode_title, e.youtube_url, e.publish_date,
               ts_rank_cd(c.search_vector, plainto_tsquery('english', :q)) AS score
        FROM transcript_chunks c
        JOIN episodes e ON e.id = c.episode_id
        WHERE c.search_vector @@ plainto_tsquery('english', :q)
        {_episode_filter_sql(episode_ids)}
        ORDER BY score DESC
        LIMIT :limit
        """,
        episode_ids,
    )
    params: dict = {"q": query, "limit": limit}
    if episode_ids:
        params["episode_ids"] = list(episode_ids)
    rows = (await session.execute(sql, params)).mappings().all()
    return [
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
        for i, row in enumerate(rows, start=1)
    ]


def reciprocal_rank_fusion(
    vector_hits: list[RetrievedChunk],
    keyword_hits: list[RetrievedChunk],
    k: int = 60,
) -> list[RetrievedChunk]:
    by_id: dict[UUID, RetrievedChunk] = {}
    for hit in vector_hits:
        # Fresh score for this fusion pass
        cloned = RetrievedChunk(
            chunk_id=hit.chunk_id,
            episode_id=hit.episode_id,
            content=hit.content,
            guest=hit.guest,
            episode_title=hit.episode_title,
            source_url=hit.source_url,
            publish_date=hit.publish_date,
            vector_rank=hit.vector_rank,
            vector_score=hit.vector_score,
            keyword_rank=hit.keyword_rank,
            keyword_score=hit.keyword_score,
            combined_score=1.0 / (k + (hit.vector_rank or 999)),
        )
        by_id[hit.chunk_id] = cloned
    for hit in keyword_hits:
        if hit.chunk_id in by_id:
            existing = by_id[hit.chunk_id]
            existing.keyword_rank = hit.keyword_rank
            existing.keyword_score = hit.keyword_score
            existing.combined_score += 1.0 / (k + (hit.keyword_rank or 999))
        else:
            by_id[hit.chunk_id] = RetrievedChunk(
                chunk_id=hit.chunk_id,
                episode_id=hit.episode_id,
                content=hit.content,
                guest=hit.guest,
                episode_title=hit.episode_title,
                source_url=hit.source_url,
                publish_date=hit.publish_date,
                vector_rank=hit.vector_rank,
                vector_score=hit.vector_score,
                keyword_rank=hit.keyword_rank,
                keyword_score=hit.keyword_score,
                combined_score=1.0 / (k + (hit.keyword_rank or 999)),
            )
    return sorted(by_id.values(), key=lambda c: c.combined_score, reverse=True)


def merge_ranked_lists(lists: list[list[RetrievedChunk]], k: int = 60) -> list[RetrievedChunk]:
    """Fuse multiple already-ranked lists (e.g. per sub-query) via RRF."""
    by_id: dict[UUID, RetrievedChunk] = {}
    for ranked in lists:
        for rank, hit in enumerate(ranked, start=1):
            if hit.chunk_id in by_id:
                existing = by_id[hit.chunk_id]
                existing.combined_score += 1.0 / (k + rank)
                if hit.vector_score is not None and (
                    existing.vector_score is None or hit.vector_score > existing.vector_score
                ):
                    existing.vector_score = hit.vector_score
                    existing.vector_rank = hit.vector_rank
                if hit.keyword_rank is not None and existing.keyword_rank is None:
                    existing.keyword_rank = hit.keyword_rank
                    existing.keyword_score = hit.keyword_score
            else:
                by_id[hit.chunk_id] = RetrievedChunk(
                    chunk_id=hit.chunk_id,
                    episode_id=hit.episode_id,
                    content=hit.content,
                    guest=hit.guest,
                    episode_title=hit.episode_title,
                    source_url=hit.source_url,
                    publish_date=hit.publish_date,
                    vector_rank=hit.vector_rank,
                    vector_score=hit.vector_score,
                    keyword_rank=hit.keyword_rank,
                    keyword_score=hit.keyword_score,
                    combined_score=1.0 / (k + rank),
                )
    return sorted(by_id.values(), key=lambda c: c.combined_score, reverse=True)


def apply_diversity(
    chunks: list[RetrievedChunk],
    max_per_episode: int,
    final_n: int,
    *,
    prefer_multi_guest: bool = False,
) -> list[RetrievedChunk]:
    selected: list[RetrievedChunk] = []
    counts: dict[UUID, int] = {}
    guests_seen: set[str] = set()

    def try_add(chunk: RetrievedChunk) -> bool:
        n = counts.get(chunk.episode_id, 0)
        if n >= max_per_episode:
            return False
        counts[chunk.episode_id] = n + 1
        guests_seen.add(chunk.guest.lower())
        selected.append(chunk)
        return True

    if prefer_multi_guest:
        # First pass: one best chunk per distinct guest to force contrast
        for chunk in chunks:
            if chunk.guest.lower() in guests_seen:
                continue
            try_add(chunk)
            if len(selected) >= final_n:
                return selected

    for chunk in chunks:
        if chunk in selected:
            continue
        if try_add(chunk) and len(selected) >= final_n:
            break
    return selected


def format_evidence(chunks: list[RetrievedChunk]) -> str:
    parts: list[str] = []
    for i, c in enumerate(chunks, start=1):
        c.citation_label = f"S{i}"
        parts.append(
            f"[{c.citation_label}]\n"
            f"Chunk ID: {c.chunk_id}\n"
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


def extract_episode_number(query: str) -> int | None:
    match = EPISODE_NUM_RE.search(query)
    if not match:
        return None
    raw = match.group(1) or match.group(2)
    if not raw:
        return None
    n = int(raw)
    return n if n > 0 else None


async def list_episode_catalog(session: AsyncSession) -> list[EpisodeRef]:
    rows = (
        await session.execute(
            text(
                """
                SELECT id, guest, title, slug
                FROM episodes
                ORDER BY publish_date ASC NULLS LAST, guest ASC
                """
            )
        )
    ).mappings().all()
    return [
        EpisodeRef(
            id=row["id"],
            guest=row["guest"],
            title=row["title"],
            slug=row["slug"],
        )
        for row in rows
    ]


def match_guests_in_text(text: str, catalog: list[EpisodeRef]) -> list[EpisodeRef]:
    """Match catalog guests whose full name appears in text (longest names first)."""
    lowered = text.lower()
    found: list[EpisodeRef] = []
    seen: set[UUID] = set()
    # Prefer longer guest names to avoid partial collisions
    ordered = sorted(catalog, key=lambda e: len(e.guest), reverse=True)
    for ep in ordered:
        name = ep.guest.strip()
        if len(name) < 3:
            continue
        if name.lower() in lowered and ep.id not in seen:
            found.append(ep)
            seen.add(ep.id)
    return found


def match_slug_or_title(text: str, catalog: list[EpisodeRef]) -> list[EpisodeRef]:
    lowered = text.lower()
    found: list[EpisodeRef] = []
    seen: set[UUID] = set()
    for ep in catalog:
        slug = ep.slug.lower().replace("-", " ")
        title = ep.title.lower()
        if (
            ep.id not in seen
            and (
                ep.slug.lower() in lowered
                or slug in lowered
                or (len(title) > 12 and title in lowered)
            )
        ):
            found.append(ep)
            seen.add(ep.id)
    return found


async def resolve_episodes(
    session: AsyncSession,
    query: str,
    catalog: list[EpisodeRef] | None = None,
) -> tuple[list[EpisodeRef], bool]:
    """
    Resolve episode refs from guest/slug/title or catalog ordinal.
    Returns (matches, scoped_missing).
    scoped_missing=True when user asked for episode N that is out of range.
    """
    catalog = catalog if catalog is not None else await list_episode_catalog(session)
    number = extract_episode_number(query)
    if number is not None:
        if number > len(catalog) or not catalog:
            return [], True
        return [catalog[number - 1]], False

    by_guest = match_guests_in_text(query, catalog)
    by_slug = match_slug_or_title(query, catalog)
    merged: list[EpisodeRef] = []
    seen: set[UUID] = set()
    for ep in by_guest + by_slug:
        if ep.id not in seen:
            merged.append(ep)
            seen.add(ep.id)
    return merged, False


def _history_entities(history_texts: list[str], catalog: list[EpisodeRef]) -> list[EpisodeRef]:
    joined = "\n".join(history_texts[-8:])
    return match_guests_in_text(joined, catalog)


def plan_retrieval(
    query: str,
    catalog: list[EpisodeRef],
    history_texts: list[str] | None = None,
    resolved: list[EpisodeRef] | None = None,
    scoped_missing: bool = False,
) -> RetrievalPlan:
    history_texts = history_texts or []
    resolved = list(resolved or [])
    q = query.strip()

    if scoped_missing:
        return RetrievalPlan(
            queries=[q],
            episode_ids=[],
            guests=[],
            intent="scoped_episode",
            scoped_missing=True,
        )

    is_comparison = bool(COMPARISON_CUES.search(q))
    is_followup = bool(FOLLOWUP_CUES.search(q)) and len(q.split()) < 18

    if not resolved and is_followup and history_texts:
        resolved = _history_entities(history_texts, catalog)

    guests = []
    seen_g: set[str] = set()
    for ep in resolved:
        key = ep.guest.lower()
        if key not in seen_g:
            guests.append(ep.guest)
            seen_g.add(key)

    episode_ids = [ep.id for ep in resolved] or None

    if is_comparison:
        intent = "comparison"
        if len(guests) >= 2:
            queries = [f"{g}: {q}" for g in guests[:3]]
        elif guests:
            # One named guest + open contrast query
            queries = [f"{guests[0]}: {q}", q]
        else:
            # Force diversity via repeated topical queries with guest cue from catalog sample
            queries = [q, f"alternative perspectives: {q}", f"contrasting advice: {q}"]
        return RetrievalPlan(
            queries=queries,
            episode_ids=episode_ids if resolved else None,
            guests=guests,
            intent=intent,
        )

    if resolved:
        intent = "followup" if is_followup else "scoped_episode"
        guest_hint = ", ".join(guests)
        rewritten = q
        if is_followup and guest_hint:
            rewritten = f"{guest_hint}: {q}"
        return RetrievalPlan(
            queries=[rewritten],
            episode_ids=episode_ids,
            guests=guests,
            intent=intent,
        )

    if is_followup and history_texts:
        # Soft rewrite: append last user topic context without hard filter
        prior = history_texts[-1][:240]
        return RetrievalPlan(
            queries=[f"{q} (context: {prior})"],
            episode_ids=None,
            guests=[],
            intent="followup",
        )

    return RetrievalPlan(queries=[q], episode_ids=None, guests=[], intent="direct")


async def hybrid_retrieve_planned(
    session: AsyncSession,
    plan: RetrievalPlan,
) -> list[RetrievedChunk]:
    if plan.scoped_missing:
        return []
    if plan.episode_ids is not None and len(plan.episode_ids) == 0:
        return []

    settings = get_settings()
    embedder = registry.get_embeddings()
    fused_lists: list[list[RetrievedChunk]] = []

    for sub_q in plan.queries[:3]:
        query_vec = await embedder.embed_query(sub_q)
        vector_hits = await vector_search(
            session,
            query_vec,
            settings.rag_vector_candidates,
            episode_ids=plan.episode_ids,
        )
        keyword_hits = await keyword_search(
            session,
            sub_q,
            settings.rag_keyword_candidates,
            episode_ids=plan.episode_ids,
        )
        fused_lists.append(
            reciprocal_rank_fusion(vector_hits, keyword_hits, settings.rag_fusion_constant)
        )

    fused = merge_ranked_lists(fused_lists, settings.rag_fusion_constant)
    final_n = settings.rag_final_chunks
    if plan.intent == "comparison":
        final_n = max(final_n, 12)
    selected = apply_diversity(
        fused,
        settings.rag_max_chunks_per_episode,
        final_n,
        prefer_multi_guest=plan.intent == "comparison",
    )
    format_evidence(selected)
    return selected


async def hybrid_retrieve(
    session: AsyncSession,
    query: str,
    history_texts: list[str] | None = None,
) -> tuple[list[RetrievedChunk], RetrievalPlan]:
    """Plan + retrieve. Returns (chunks, plan)."""
    catalog = await list_episode_catalog(session)
    resolved, scoped_missing = await resolve_episodes(session, query, catalog)
    plan = plan_retrieval(
        query,
        catalog,
        history_texts=history_texts,
        resolved=resolved,
        scoped_missing=scoped_missing,
    )
    chunks = await hybrid_retrieve_planned(session, plan)
    return chunks, plan


def should_abstain(
    chunks: list[RetrievedChunk],
    *,
    intent: str = "direct",
    scoped_missing: bool = False,
) -> bool:
    """Abstain when evidence is empty, missing a scoped episode, or weakly relevant."""
    if scoped_missing:
        return True
    if not chunks:
        return True
    best_vector = max((c.vector_score or 0.0) for c in chunks)
    # Keyword hits alone are not enough — require minimum vector similarity
    if best_vector < VECTOR_ABSTAIN_THRESHOLD:
        return True
    if intent == "comparison":
        guests = {c.guest.lower() for c in chunks}
        if len(guests) < 2:
            return True
    return False
