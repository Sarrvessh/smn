from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol

from pydantic import BaseModel


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


@dataclass
class GenerationOptions:
    model: str | None = None
    temperature: float = 0.2
    max_tokens: int | None = None
    stop: list[str] | None = None


@dataclass
class GenerationResult:
    text: str
    model: str
    provider: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass
class StreamEvent:
    type: Literal["token", "error", "done"]
    text: str = ""
    error_code: str | None = None
    error_message: str | None = None


@dataclass
class ProviderHealth:
    id: str
    configured: bool
    healthy: bool
    models: list[str] = field(default_factory=list)
    detail: str | None = None


class LLMProvider(Protocol):
    id: str

    async def healthcheck(self) -> ProviderHealth: ...

    async def generate(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> GenerationResult: ...

    async def stream(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[StreamEvent]: ...

    async def generate_structured(
        self,
        messages: list[ChatMessage],
        schema: type[BaseModel],
        options: GenerationOptions,
    ) -> BaseModel: ...


class EmbeddingProvider(Protocol):
    async def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...
