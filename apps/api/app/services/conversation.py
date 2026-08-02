from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.formatting import normalize_qa_markdown
from app.agents.schemas import route_skill
from app.agents.skills import iter_transcript_qa, run_artifact, run_ship30
from app.core.config import get_settings
from app.core.errors import (
    INVALID_SESSION,
    KNOWLEDGE_BASE_EMPTY,
    OLLAMA_MODEL_MISSING,
    STREAM_INTERRUPTED,
    AppError,
)
from app.core.security import validate_artifact_content
from app.db.models import AgentRun, Artifact, ChatSession, Message, MessageSource
from app.ingestion.pipeline import knowledge_status
from app.llm.base import ChatMessage
from app.llm.registry import default_chat_model
from app.retrieval.citations import validate_citations
from app.retrieval.hybrid_search import hybrid_retrieve, should_abstain, to_source_payload

logger = logging.getLogger(__name__)


def ndjson(event: str, **payload) -> str:
    return json.dumps({"event": event, **payload}, default=str) + "\n"


def _is_embedding_model(name: str | None) -> bool:
    if not name:
        return False
    n = name.lower()
    return any(x in n for x in ("embed", "embedding", "bge-", "minilm"))


async def get_owned_session(session: AsyncSession, session_id: UUID, user_id: UUID) -> ChatSession:
    result = await session.execute(
        select(ChatSession).where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    chat = result.scalar_one_or_none()
    if not chat:
        raise AppError(INVALID_SESSION, "Session not found.", retryable=False, status_code=404)
    return chat


async def _mark_cancelled(
    db: AsyncSession,
    assistant_msg: Message,
    run: AgentRun,
    started: float,
    partial_text: str = "",
) -> None:
    """Persist terminal cancellation when the HTTP stream is closed early."""
    if assistant_msg.status != "streaming" or run.status != "running":
        return
    assistant_msg.status = "cancelled"
    assistant_msg.error_code = STREAM_INTERRUPTED
    if partial_text.strip():
        assistant_msg.content = partial_text
    run.status = "cancelled"
    run.error_code = STREAM_INTERRUPTED
    run.duration_ms = int((time.time() - started) * 1000)
    await db.commit()


async def stream_message(
    db: AsyncSession,
    session_id: UUID,
    user_id: UUID,
    content: str,
    mode: str = "auto",
    provider: str | None = None,
    model: str | None = None,
) -> AsyncIterator[str]:
    settings = get_settings()
    if len(content) > settings.max_user_message_characters:
        yield ndjson(
            "error",
            code="MESSAGE_TOO_LONG",
            message="Message exceeds maximum length.",
            retryable=False,
        )
        return

    started = time.time()
    chat = await get_owned_session(db, session_id, user_id)
    provider_name = provider or chat.provider or settings.default_llm_provider
    model_name = model or chat.model or default_chat_model(provider_name, settings)
    if _is_embedding_model(model_name):
        model_name = default_chat_model(provider_name, settings)
    chat.provider = provider_name
    chat.model = model_name
    chat.updated_at = datetime.now(UTC)

    now = datetime.now(UTC)
    user_msg = Message(
        id=uuid4(),
        session_id=chat.id,
        role="user",
        content=content,
        status="completed",
        created_at=now,
    )
    assistant_msg = Message(
        id=uuid4(),
        session_id=chat.id,
        role="assistant",
        content="",
        status="streaming",
        provider=provider_name,
        model=model_name,
        # Ensure stable user → assistant order when listing by created_at
        created_at=now + timedelta(milliseconds=1),
    )
    db.add(user_msg)
    db.add(assistant_msg)
    await db.flush()

    run = AgentRun(
        id=uuid4(),
        session_id=chat.id,
        message_id=assistant_msg.id,
        skill="pending",
        routing_method="pending",
        provider=provider_name,
        model=model_name or "",
        status="running",
    )
    db.add(run)
    await db.commit()

    yield ndjson("run_started", run_id=str(run.id), message_id=str(assistant_msg.id))

    answer_text = ""
    try:
        if _is_embedding_model(model):
            raise AppError(
                OLLAMA_MODEL_MISSING,
                f"'{model}' is an embedding model. Choose a chat model like "
                f"{default_chat_model(provider_name, settings)}.",
                retryable=False,
                status_code=400,
            )

        yield ndjson("status", stage="routing", label="Choosing skill")
        decision = route_skill(content, mode)
        run.skill = decision.skill
        run.routing_method = decision.routing_method
        run.metadata_ = {
            "reason": decision.reason,
            "confidence": decision.confidence,
            "artifact_type": decision.artifact_type,
        }
        assistant_msg.skill = decision.skill
        await db.commit()

        kb = await knowledge_status(db)
        if not kb["ready"] and decision.skill == "transcript_qa":
            raise AppError(
                KNOWLEDGE_BASE_EMPTY,
                "Transcript ingestion has not been completed. Run: make corpus && make ingest",
                retryable=False,
                status_code=400,
            )

        yield ndjson("status", stage="retrieving", label="Searching Lenny's transcripts")
        retrieval_started = time.time()

        hist_rows = (
            (
                await db.execute(
                    select(Message)
                    .where(Message.session_id == chat.id, Message.id != assistant_msg.id)
                    .order_by(Message.created_at.desc())
                    .limit(12)
                )
            )
            .scalars()
            .all()
        )
        history = [
            ChatMessage(
                role=m.role if m.role in {"user", "assistant", "system"} else "user",
                content=m.content,
            )
            for m in reversed(hist_rows)
            if m.role in {"user", "assistant"}
        ]
        history_texts = [m.content for m in history]

        chunks, retrieval_plan = await hybrid_retrieve(db, content, history_texts=history_texts)
        retrieval_ms = int((time.time() - retrieval_started) * 1000)
        run.retrieved_chunks = len(chunks)
        run.metadata_ = {
            **(run.metadata_ or {}),
            "retrieval_intent": retrieval_plan.intent,
            "retrieval_guests": retrieval_plan.guests,
            "retrieval_queries": retrieval_plan.queries,
            "scoped_missing": retrieval_plan.scoped_missing,
        }
        await db.commit()
        sources = to_source_payload(chunks)
        yield ndjson("sources", sources=sources)

        yield ndjson("status", stage="generating", label="Generating answer…")
        gen_started = time.time()
        title = None
        artifact_type = None
        content_body = None

        if decision.skill == "ship30_essay":
            yield ndjson("status", stage="generating", label="Writing Ship30 essay…")
            result = await run_ship30(content, chunks, history, provider_name, model_name)
            answer_text = result.markdown
            title = result.title
            artifact_type = "markdown"
            # Stream essay after generation so UI fills quickly once ready
            for i in range(0, len(answer_text), 40):
                yield ndjson("token", text=answer_text[i : i + 40])
        elif decision.skill == "artifact_generator":
            yield ndjson("status", stage="generating", label="Creating artifact…")
            result = await run_artifact(
                content, chunks, history, provider_name, model_name, decision.artifact_type
            )
            answer_text = (
                result.summary or f"Created {result.artifact_type} artifact: {result.title}"
            )
            title = result.title
            artifact_type = result.artifact_type
            content_body = result.content
            for i in range(0, len(answer_text), 40):
                yield ndjson("token", text=answer_text[i : i + 40])
        else:
            # Live token stream for Q&A
            async for piece in iter_transcript_qa(
                content,
                chunks,
                history,
                provider_name,
                model_name,
                intent=retrieval_plan.intent,
                scoped_missing=retrieval_plan.scoped_missing,
            ):
                answer_text += piece
                yield ndjson("token", text=piece)

        if decision.skill == "transcript_qa":
            answer_text = normalize_qa_markdown(answer_text)

        generation_ms = int((time.time() - gen_started) * 1000)

        yield ndjson("status", stage="validating", label="Validating citations")
        valid_ids = {s["id"] for s in sources}
        if decision.skill == "artifact_generator":
            cleaned, _summary_cites, summary_invalid_cites = validate_citations(
                answer_text, valid_ids
            )
            content_body, valid_cites, invalid_cites = validate_citations(
                content_body or "", valid_ids
            )
            invalid_cites = sorted(set(invalid_cites + summary_invalid_cites))
        else:
            cleaned, valid_cites, invalid_cites = validate_citations(answer_text, valid_ids)
        if decision.skill == "transcript_qa":
            cleaned = normalize_qa_markdown(cleaned)
        if invalid_cites:
            logger.info("Removed invalid citations: %s", invalid_cites)

        # Always push the final polished text so the client matches persistence
        if cleaned != answer_text:
            yield ndjson("content_replace", text=cleaned)

        label_to_chunk = {s["id"]: s for s in sources}
        for rank, label in enumerate(valid_cites, start=1):
            meta = label_to_chunk.get(label)
            if not meta:
                continue
            db.add(
                MessageSource(
                    message_id=assistant_msg.id,
                    chunk_id=UUID(meta["chunk_id"]),
                    citation_label=label,
                    rank=rank,
                    retrieval_score=meta.get("score"),
                )
            )

        if decision.skill in {"ship30_essay", "artifact_generator"}:
            body = cleaned if decision.skill == "ship30_essay" else content_body
            try:
                body = validate_artifact_content(
                    artifact_type or "markdown",
                    body or "",
                    settings.max_artifact_characters,
                )
            except ValueError as exc:
                raise AppError(
                    "ARTIFACT_VALIDATION_FAILED",
                    str(exc),
                    retryable=False,
                    status_code=400,
                ) from exc
            art = Artifact(
                id=uuid4(),
                session_id=chat.id,
                message_id=assistant_msg.id,
                type=artifact_type or "markdown",
                title=title or "Artifact",
                content=body,
                language=artifact_type or "markdown",
            )
            db.add(art)
            await db.flush()
            yield ndjson(
                "artifact",
                artifact_id=str(art.id),
                type=art.type,
                title=art.title,
            )
            if decision.skill == "ship30_essay":
                cleaned = (
                    f"**{art.title}**\n\nEssay artifact ready in the side panel.\n\n" + cleaned
                )

        if not cleaned.strip():
            cleaned = (
                "The model returned an empty answer. "
                f"Confirm the selected {provider_name} chat model is available "
                f"(e.g. {default_chat_model(provider_name, settings)}) and retry."
            )
            yield ndjson("token", text=cleaned)

        yield ndjson("status", stage="saving", label="Saving response")
        assistant_msg.content = cleaned
        assistant_msg.status = "completed"
        assistant_msg.latency_ms = int((time.time() - started) * 1000)
        run.status = "completed"
        run.duration_ms = assistant_msg.latency_ms
        run.metadata_ = {
            **(run.metadata_ or {}),
            "retrieval_ms": retrieval_ms,
            "generation_ms": generation_ms,
            "invalid_citations": invalid_cites,
            "abstained": should_abstain(
                chunks,
                intent=retrieval_plan.intent,
                scoped_missing=retrieval_plan.scoped_missing,
            )
            and decision.skill == "transcript_qa",
        }
        if chat.title == "New chat" and content.strip():
            chat.title = content.strip()[:80]
        await db.commit()

        yield ndjson(
            "completed",
            message_id=str(assistant_msg.id),
            skill=decision.skill,
            latency_ms=assistant_msg.latency_ms,
        )
    except AppError as exc:
        assistant_msg.status = "failed"
        assistant_msg.error_code = exc.code
        assistant_msg.content = assistant_msg.content or exc.message
        run.status = "failed"
        run.error_code = exc.code
        run.duration_ms = int((time.time() - started) * 1000)
        await db.commit()
        yield ndjson("error", code=exc.code, message=exc.message, retryable=exc.retryable)
    except asyncio.CancelledError:
        await asyncio.shield(_mark_cancelled(db, assistant_msg, run, started, answer_text))
        raise
    except GeneratorExit:
        await _mark_cancelled(db, assistant_msg, run, started, answer_text)
        raise
    except Exception:
        logger.exception("stream_message failed")
        assistant_msg.status = "failed"
        assistant_msg.error_code = STREAM_INTERRUPTED
        assistant_msg.content = assistant_msg.content or "Generation was interrupted unexpectedly."
        run.status = "failed"
        run.error_code = STREAM_INTERRUPTED
        run.duration_ms = int((time.time() - started) * 1000)
        await db.commit()
        yield ndjson(
            "error",
            code=STREAM_INTERRUPTED,
            message="Generation was interrupted unexpectedly. Retry the request.",
            retryable=True,
        )
