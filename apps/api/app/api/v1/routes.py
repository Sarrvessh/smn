from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError, INVALID_SESSION
from app.db.models import ChatSession, Message, MessageSource, TranscriptChunk, User
from app.db.session import get_db
from app.ingestion.pipeline import knowledge_status
from app.llm.registry import registry
from app.services.conversation import get_owned_session
from datetime import datetime, timezone
from uuid import uuid4

router = APIRouter()


async def require_user(
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not x_user_id:
        raise AppError("UNAUTHORIZED", "Missing X-User-Id header.", retryable=False, status_code=401)
    try:
        uid = UUID(x_user_id)
    except ValueError as exc:
        raise AppError("UNAUTHORIZED", "Invalid X-User-Id.", retryable=False, status_code=401) from exc
    user = (await db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
    if not user:
        raise AppError("UNAUTHORIZED", "Unknown user.", retryable=False, status_code=401)
    user.last_seen_at = datetime.now(timezone.utc)
    await db.commit()
    return user


class AnonymousUserOut(BaseModel):
    id: UUID
    created_at: datetime


@router.post("/users/anonymous", response_model=AnonymousUserOut, status_code=201)
async def create_anonymous_user(db: AsyncSession = Depends(get_db)) -> AnonymousUserOut:
    user = User(id=uuid4())
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return AnonymousUserOut(id=user.id, created_at=user.created_at)


class SessionCreate(BaseModel):
    title: str = "New chat"
    provider: str = "ollama"
    model: str = "qwen2.5:7b"


class SessionUpdate(BaseModel):
    title: str | None = None
    provider: str | None = None
    model: str | None = None
    archived: bool | None = None


class SessionOut(BaseModel):
    id: UUID
    title: str
    provider: str
    model: str
    created_at: datetime
    updated_at: datetime
    archived_at: datetime | None = None


@router.post("/sessions", response_model=SessionOut, status_code=201)
async def create_session(
    body: SessionCreate,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> SessionOut:
    chat = ChatSession(
        id=uuid4(),
        user_id=user.id,
        title=body.title,
        provider=body.provider,
        model=body.model,
    )
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return SessionOut(
        id=chat.id,
        title=chat.title,
        provider=chat.provider,
        model=chat.model,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        archived_at=chat.archived_at,
    )


@router.get("/sessions", response_model=list[SessionOut])
async def list_sessions(
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> list[SessionOut]:
    rows = (
        await db.execute(
            select(ChatSession)
            .where(ChatSession.user_id == user.id, ChatSession.archived_at.is_(None))
            .order_by(ChatSession.updated_at.desc())
        )
    ).scalars().all()
    return [
        SessionOut(
            id=s.id,
            title=s.title,
            provider=s.provider,
            model=s.model,
            created_at=s.created_at,
            updated_at=s.updated_at,
            archived_at=s.archived_at,
        )
        for s in rows
    ]


@router.get("/sessions/{session_id}", response_model=SessionOut)
async def get_session(
    session_id: UUID,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> SessionOut:
    chat = await get_owned_session(db, session_id, user.id)
    return SessionOut(
        id=chat.id,
        title=chat.title,
        provider=chat.provider,
        model=chat.model,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        archived_at=chat.archived_at,
    )


@router.patch("/sessions/{session_id}", response_model=SessionOut)
async def patch_session(
    session_id: UUID,
    body: SessionUpdate,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> SessionOut:
    chat = await get_owned_session(db, session_id, user.id)
    if body.title is not None:
        chat.title = body.title
    if body.provider is not None:
        chat.provider = body.provider
    if body.model is not None:
        chat.model = body.model
    if body.archived is True:
        chat.archived_at = datetime.now(timezone.utc)
    if body.archived is False:
        chat.archived_at = None
    chat.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(chat)
    return SessionOut(
        id=chat.id,
        title=chat.title,
        provider=chat.provider,
        model=chat.model,
        created_at=chat.created_at,
        updated_at=chat.updated_at,
        archived_at=chat.archived_at,
    )


@router.delete("/sessions/{session_id}", status_code=204)
async def delete_session(
    session_id: UUID,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    chat = await get_owned_session(db, session_id, user.id)
    chat.archived_at = datetime.now(timezone.utc)
    await db.commit()
    return Response(status_code=204)


class SourceOut(BaseModel):
    citation_label: str
    rank: int
    guest: str | None = None
    episode: str | None = None
    excerpt: str | None = None
    url: str | None = None


class MessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    status: str
    skill: str | None = None
    provider: str | None = None
    model: str | None = None
    latency_ms: int | None = None
    error_code: str | None = None
    created_at: datetime
    sources: list[SourceOut] = Field(default_factory=list)


@router.get("/sessions/{session_id}/messages", response_model=list[MessageOut])
async def list_messages(
    session_id: UUID,
    user: User = Depends(require_user),
    db: AsyncSession = Depends(get_db),
) -> list[MessageOut]:
    await get_owned_session(db, session_id, user.id)
    rows = (
        await db.execute(
            select(Message)
            .where(Message.session_id == session_id)
            .options(
                selectinload(Message.sources)
                .selectinload(MessageSource.chunk)
                .selectinload(TranscriptChunk.episode)
            )
            .order_by(Message.created_at.asc())
        )
    ).scalars().all()
    out: list[MessageOut] = []
    for m in rows:
        sources: list[SourceOut] = []
        for s in m.sources:
            chunk = s.chunk
            episode = chunk.episode if chunk else None
            sources.append(
                SourceOut(
                    citation_label=s.citation_label,
                    rank=s.rank,
                    guest=episode.guest if episode else None,
                    episode=episode.title if episode else None,
                    excerpt=(chunk.content[:400] if chunk else None),
                    url=episode.youtube_url if episode else None,
                )
            )
        out.append(
            MessageOut(
                id=m.id,
                role=m.role,
                content=m.content,
                status=m.status,
                skill=m.skill,
                provider=m.provider,
                model=m.model,
                latency_ms=m.latency_ms,
                error_code=m.error_code,
                created_at=m.created_at,
                sources=sources,
            )
        )
    return out


class StreamRequest(BaseModel):
    content: str
    mode: str = "auto"
    provider: str | None = None
    model: str | None = None


@router.get("/providers")
@router.get("/providers/health")
async def providers_health() -> dict:
    return await registry.health()


@router.get("/knowledge/status")
async def kb_status(db: AsyncSession = Depends(get_db)) -> dict:
    return await knowledge_status(db)
