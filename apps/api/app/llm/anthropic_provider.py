from __future__ import annotations

import json
from collections.abc import AsyncIterator

from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import AppError, PROVIDER_NOT_CONFIGURED, PROVIDER_TIMEOUT
from app.llm.base import (
    ChatMessage,
    GenerationOptions,
    GenerationResult,
    ProviderHealth,
    StreamEvent,
)


class AnthropicProvider:
    id = "anthropic"

    def __init__(self) -> None:
        self.settings = get_settings()

    def _client(self):
        if not self.settings.anthropic_api_key:
            raise AppError(
                PROVIDER_NOT_CONFIGURED,
                "Anthropic is not configured. Add ANTHROPIC_API_KEY or switch to Ollama.",
                retryable=False,
                status_code=400,
            )
        from anthropic import AsyncAnthropic

        return AsyncAnthropic(api_key=self.settings.anthropic_api_key)

    async def healthcheck(self) -> ProviderHealth:
        configured = bool(self.settings.anthropic_api_key)
        models = [self.settings.anthropic_model] if configured else []
        return ProviderHealth(
            id=self.id,
            configured=configured,
            healthy=configured,
            models=models,
            detail=None if configured else "Missing ANTHROPIC_API_KEY",
        )

    def _split_system(self, messages: list[ChatMessage]) -> tuple[str | None, list[dict]]:
        system_parts = [m.content for m in messages if m.role == "system"]
        chat = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
        system = "\n\n".join(system_parts) if system_parts else None
        return system, chat

    async def generate(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> GenerationResult:
        client = self._client()
        model = options.model or self.settings.anthropic_model
        system, chat = self._split_system(messages)
        try:
            kwargs: dict = {
                "model": model,
                "max_tokens": options.max_tokens or 4096,
                "temperature": options.temperature,
                "messages": chat,
            }
            if system:
                kwargs["system"] = system
            resp = await client.messages.create(**kwargs)
            text = "".join(b.text for b in resp.content if getattr(b, "type", "") == "text")
            return GenerationResult(text=text, model=model, provider=self.id, raw=resp.model_dump())
        except AppError:
            raise
        except Exception as exc:  # noqa: BLE001
            if "timeout" in str(exc).lower():
                raise AppError(PROVIDER_TIMEOUT, "Anthropic request timed out.", retryable=True, status_code=504) from exc
            raise AppError("PROVIDER_ERROR", str(exc), retryable=True, status_code=502) from exc

    async def stream(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[StreamEvent]:
        try:
            client = self._client()
            model = options.model or self.settings.anthropic_model
            system, chat = self._split_system(messages)
            kwargs: dict = {
                "model": model,
                "max_tokens": options.max_tokens or 4096,
                "temperature": options.temperature,
                "messages": chat,
            }
            if system:
                kwargs["system"] = system
            async with client.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    yield StreamEvent(type="token", text=text)
            yield StreamEvent(type="done")
        except AppError as exc:
            yield StreamEvent(type="error", error_code=exc.code, error_message=exc.message)
        except Exception as exc:  # noqa: BLE001
            yield StreamEvent(type="error", error_code="PROVIDER_ERROR", error_message=str(exc))

    async def generate_structured(
        self,
        messages: list[ChatMessage],
        schema: type[BaseModel],
        options: GenerationOptions,
    ) -> BaseModel:
        schema_json = json.dumps(schema.model_json_schema())
        instructed = list(messages) + [
            ChatMessage(
                role="user",
                content=f"Respond with valid JSON only matching this schema:\n{schema_json}",
            )
        ]
        result = await self.generate(instructed, options)
        text = result.text.strip()
        if text.startswith("```"):
            text = text.strip("`")
            if text.startswith("json"):
                text = text[4:].strip()
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            text = text[start : end + 1]
        return schema.model_validate_json(text)
