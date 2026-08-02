from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import PROVIDER_NOT_CONFIGURED, PROVIDER_TIMEOUT, AppError
from app.llm.base import (
    ChatMessage,
    GenerationOptions,
    GenerationResult,
    ProviderHealth,
    StreamEvent,
)

logger = logging.getLogger(__name__)


class AnthropicProvider:
    id = "anthropic"

    def __init__(self) -> None:
        self.settings = get_settings()

    def _timeout(self) -> httpx.Timeout:
        seconds = float(self.settings.llm_request_timeout_seconds)
        return httpx.Timeout(seconds, connect=10.0)

    def _client(
        self,
        *,
        timeout: httpx.Timeout | None = None,
        max_retries: int | None = None,
    ):
        if not self.settings.anthropic_api_key:
            raise AppError(
                PROVIDER_NOT_CONFIGURED,
                "Anthropic is not configured. Add ANTHROPIC_API_KEY or switch to Ollama.",
                retryable=False,
                status_code=400,
            )
        from anthropic import AsyncAnthropic

        return AsyncAnthropic(
            api_key=self.settings.anthropic_api_key,
            timeout=timeout or self._timeout(),
            max_retries=(self.settings.llm_max_retries if max_retries is None else max_retries),
        )

    async def healthcheck(self) -> ProviderHealth:
        configured = bool(self.settings.anthropic_api_key)
        if not configured:
            return ProviderHealth(
                id=self.id,
                configured=False,
                healthy=False,
                models=[],
                detail="Missing ANTHROPIC_API_KEY",
            )
        try:
            client = self._client(
                timeout=httpx.Timeout(8.0, connect=5.0),
                max_retries=0,
            )
            page = await client.models.list(limit=100)
            available = [item.id for item in getattr(page, "data", []) if item.id]
            selected = self.settings.anthropic_model
            models = [selected] + [model for model in available if model != selected]
            return ProviderHealth(
                id=self.id,
                configured=True,
                healthy=True,
                models=models,
            )
        except Exception as exc:  # noqa: BLE001
            mapped = self._map_error(exc)
            return ProviderHealth(
                id=self.id,
                configured=True,
                healthy=False,
                models=[self.settings.anthropic_model],
                detail=mapped.message,
            )

    def _split_system(self, messages: list[ChatMessage]) -> tuple[str | None, list[dict]]:
        system_parts = [m.content for m in messages if m.role == "system"]
        chat: list[dict] = []
        for message in messages:
            if message.role == "system":
                continue
            content = message.content.strip()
            if not content:
                continue
            # Anthropic messages must begin with a user turn; trim stale leading assistant history.
            if message.role == "assistant" and not chat:
                continue
            if chat and chat[-1]["role"] == message.role:
                chat[-1]["content"] += f"\n\n{content}"
            else:
                chat.append({"role": message.role, "content": content})
        if not chat:
            chat.append({"role": "user", "content": "Please follow the system instructions."})
        system = "\n\n".join(system_parts) if system_parts else None
        return system, chat

    def _request_kwargs(self, messages: list[ChatMessage], options: GenerationOptions) -> dict:
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
        if options.stop:
            kwargs["stop_sequences"] = options.stop
        return kwargs

    def _map_error(self, exc: Exception) -> AppError:
        if isinstance(exc, AppError):
            return exc

        from anthropic import (
            APIConnectionError,
            APIStatusError,
            APITimeoutError,
            AuthenticationError,
            BadRequestError,
            InternalServerError,
            NotFoundError,
            OverloadedError,
            PermissionDeniedError,
            RateLimitError,
            RequestTooLargeError,
            UnprocessableEntityError,
        )

        if isinstance(exc, APITimeoutError):
            return AppError(
                PROVIDER_TIMEOUT,
                "Anthropic request timed out.",
                retryable=True,
                status_code=504,
            )
        if isinstance(exc, (AuthenticationError, PermissionDeniedError)):
            return AppError(
                PROVIDER_NOT_CONFIGURED,
                "Anthropic rejected the API key. Check ANTHROPIC_API_KEY.",
                retryable=False,
                status_code=400,
            )
        if isinstance(
            exc, (RateLimitError, OverloadedError, InternalServerError, APIConnectionError)
        ):
            return AppError(
                "PROVIDER_ERROR",
                f"Anthropic temporarily failed: {str(exc)[:400]}",
                retryable=True,
                status_code=502,
            )
        if isinstance(
            exc, (BadRequestError, NotFoundError, RequestTooLargeError, UnprocessableEntityError)
        ):
            return AppError(
                "PROVIDER_ERROR",
                f"Anthropic rejected the request: {str(exc)[:400]}",
                retryable=False,
                status_code=400,
            )
        if isinstance(exc, APIStatusError):
            status = exc.status_code
            return AppError(
                "PROVIDER_ERROR",
                f"Anthropic error ({status}): {str(exc)[:400]}",
                retryable=status >= 500,
                status_code=502 if status >= 500 else 400,
            )
        return AppError("PROVIDER_ERROR", str(exc), retryable=True, status_code=502)

    def _extract_text(self, response) -> str:
        parts: list[str] = []
        for block in getattr(response, "content", []) or []:
            if getattr(block, "type", "") == "text" and getattr(block, "text", None):
                parts.append(block.text)
        return "".join(parts)

    async def generate(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> GenerationResult:
        client = self._client()
        model = options.model or self.settings.anthropic_model
        try:
            kwargs = self._request_kwargs(messages, options)
            resp = await client.messages.create(**kwargs)
            text = self._extract_text(resp)
            response_model = getattr(resp, "model", None) or model
            raw = resp.model_dump() if hasattr(resp, "model_dump") else {}
            return GenerationResult(text=text, model=response_model, provider=self.id, raw=raw)
        except Exception as exc:
            raise self._map_error(exc) from exc

    async def stream(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[StreamEvent]:
        try:
            client = self._client()
            kwargs = self._request_kwargs(messages, options)
            async with client.messages.stream(**kwargs) as stream:
                async for text in stream.text_stream:
                    yield StreamEvent(type="token", text=text)
            yield StreamEvent(type="done")
        except AppError as exc:
            yield StreamEvent(type="error", error_code=exc.code, error_message=exc.message)
        except Exception as exc:
            mapped = self._map_error(exc)
            logger.debug("Anthropic stream failed", exc_info=True)
            yield StreamEvent(type="error", error_code=mapped.code, error_message=mapped.message)

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
