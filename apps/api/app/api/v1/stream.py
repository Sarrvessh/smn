from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.routes import require_user
from app.core.errors import INVALID_SESSION, AppError
from app.db.models import Artifact, ChatSession, User
from app.db.session import get_db
from app.services.conversation import stream_message

router = APIRouter()


class StreamRequest(BaseModel):
    content: str
    mode: str = "auto"
    provider: str | None = None
    model: str | None = None


@router.post("/sessions/{session_id}/messages/stream")
async def messages_stream(
    session_id: UUID,
    body: StreamRequest,
    request: Request,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    async def event_gen():
        generation = stream_message(
            db,
            session_id,
            user.id,
            body.content,
            mode=body.mode,
            provider=body.provider,
            model=body.model,
        )
        try:
            async for line in generation:
                if await request.is_disconnected():
                    break
                yield line
        finally:
            await generation.aclose()

    return StreamingResponse(event_gen(), media_type="application/x-ndjson")


class ArtifactOut(BaseModel):
    id: UUID
    session_id: UUID
    message_id: UUID
    type: str
    title: str
    content: str
    language: str
    created_at: str


class ArtifactListItem(BaseModel):
    id: UUID
    session_id: UUID
    message_id: UUID
    type: str
    title: str
    language: str
    created_at: str
    session_title: str
    session_archived: bool


@router.get("/artifacts", response_model=list[ArtifactListItem])
async def list_artifacts(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> list[ArtifactListItem]:
    """All workspace artifacts, newest first, with the chat title they belong to."""
    rows = (
        await db.execute(
            select(Artifact, ChatSession.title, ChatSession.archived_at)
            .join(ChatSession, ChatSession.id == Artifact.session_id)
            .where(ChatSession.user_id == user.id)
            .order_by(Artifact.created_at.desc())
        )
    ).all()
    return [
        ArtifactListItem(
            id=art.id,
            session_id=art.session_id,
            message_id=art.message_id,
            type=art.type,
            title=art.title,
            language=art.language,
            created_at=art.created_at.isoformat(),
            session_title=session_title,
            session_archived=session_archived_at is not None,
        )
        for art, session_title, session_archived_at in rows
    ]


@router.get("/artifacts/{artifact_id}")
async def get_artifact(
    artifact_id: UUID,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    art = (
        await db.execute(
            select(Artifact)
            .join(ChatSession, ChatSession.id == Artifact.session_id)
            .where(Artifact.id == artifact_id, ChatSession.user_id == user.id)
        )
    ).scalar_one_or_none()
    if not art:
        raise AppError(INVALID_SESSION, "Artifact not found.", retryable=False, status_code=404)
    return {
        "id": art.id,
        "session_id": art.session_id,
        "message_id": art.message_id,
        "type": art.type,
        "title": art.title,
        "content": art.content,
        "language": art.language,
        "created_at": art.created_at.isoformat(),
    }
