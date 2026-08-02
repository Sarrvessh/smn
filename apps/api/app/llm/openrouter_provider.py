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


class OpenRouterProvider:
    """OpenAI-compatible chat provider via OpenRouter (dev / alternate cloud)."""

    id = "openrouter"

    def __init__(self) -> None:
        self.settings = get_settings()

    @property
    def base_url(self) -> str:
        return self.settings.openrouter_base_url.rstrip("/")

    def _headers(self) -> dict[str, str]:
        if not self.settings.openrouter_api_key:
            raise AppError(
                PROVIDER_NOT_CONFIGURED,
                "OpenRouter is not configured. Add OPENROUTER_API_KEY or switch provider.",
                retryable=False,
                status_code=400,
            )
        headers = {
            "Authorization": f"Bearer {self.settings.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        if self.settings.openrouter_http_referer:
            headers["HTTP-Referer"] = self.settings.openrouter_http_referer
        if self.settings.openrouter_app_title:
            headers["X-Title"] = self.settings.openrouter_app_title
        return headers

    def _configured_models(self) -> list[str]:
        raw = self.settings.openrouter_models.strip()
        models = [m.strip() for m in raw.split(",") if m.strip()] if raw else []
        default = self.settings.openrouter_model.strip()
        if default:
            models = [default] + [m for m in models if m != default]
        return models

    def _timeout(self) -> httpx.Timeout:
        seconds = float(self.settings.llm_request_timeout_seconds)
        return httpx.Timeout(seconds, connect=10.0)

    async def healthcheck(self) -> ProviderHealth:
        models = self._configured_models()
        if not self.settings.openrouter_api_key:
            return ProviderHealth(
                id=self.id,
                configured=False,
                healthy=False,
                models=[],
                detail="Missing OPENROUTER_API_KEY",
            )
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{self.base_url}/auth/key",
                    headers=self._headers(),
                )
                if resp.status_code >= 400:
                    return ProviderHealth(
                        id=self.id,
                        configured=True,
                        healthy=False,
                        models=models,
                        detail=f"OpenRouter auth failed ({resp.status_code})",
                    )
            return ProviderHealth(
                id=self.id,
                configured=True,
                healthy=True,
                models=models,
            )
        except AppError as exc:
            return ProviderHealth(
                id=self.id,
                configured=False,
                healthy=False,
                models=[],
                detail=exc.message,
            )
        except Exception as exc:  # noqa: BLE001
            return ProviderHealth(
                id=self.id,
                configured=True,
                healthy=False,
                models=models,
                detail=str(exc),
            )

    def _payload(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
        *,
        stream: bool,
    ) -> dict:
        model = options.model or self.settings.openrouter_model
        payload: dict = {
            "model": model,
            "messages": [m.model_dump() for m in messages],
            "stream": stream,
            "temperature": options.temperature,
        }
        if options.max_tokens is not None:
            payload["max_tokens"] = options.max_tokens
        if options.stop:
            payload["stop"] = options.stop
        return payload

    def _map_error(self, exc: Exception) -> AppError:
        if isinstance(exc, AppError):
            return exc
        if isinstance(exc, httpx.TimeoutException):
            return AppError(
                PROVIDER_TIMEOUT,
                "OpenRouter request timed out.",
                retryable=True,
                status_code=504,
            )
        if isinstance(exc, httpx.HTTPStatusError):
            status = exc.response.status_code
            body = (exc.response.text or "")[:400]
            lowered = body.lower()
            if status in {401, 403}:
                return AppError(
                    PROVIDER_NOT_CONFIGURED,
                    "OpenRouter rejected the API key. Check OPENROUTER_API_KEY.",
                    retryable=False,
                    status_code=400,
                )
            if status == 404 and (
                "data policy" in lowered or "guardrail" in lowered or "no endpoints" in lowered
            ):
                return AppError(
                    "PROVIDER_ERROR",
                    "OpenRouter blocked this model under your privacy/guardrail settings. "
                    "Pick another model in the header, or relax restrictions at "
                    "https://openrouter.ai/settings/privacy (and Ignored/Allowed providers).",
                    retryable=False,
                    status_code=400,
                )
            return AppError(
                "PROVIDER_ERROR",
                f"OpenRouter error ({status}): {body or str(exc)}",
                retryable=status >= 500,
                status_code=502,
            )
        return AppError("PROVIDER_ERROR", str(exc), retryable=True, status_code=502)

    async def generate(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> GenerationResult:
        model = options.model or self.settings.openrouter_model
        try:
            async with httpx.AsyncClient(timeout=self._timeout()) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=self._payload(messages, options, stream=False),
                )
                resp.raise_for_status()
                data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                raise AppError("PROVIDER_ERROR", "OpenRouter returned no choices.", retryable=True)
            message = choices[0].get("message") or {}
            text = message.get("content") or ""
            return GenerationResult(
                text=text,
                model=data.get("model") or model,
                provider=self.id,
                raw=data if isinstance(data, dict) else {},
            )
        except Exception as exc:
            raise self._map_error(exc) from exc

    async def stream(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[StreamEvent]:
        try:
            async with (
                httpx.AsyncClient(timeout=self._timeout()) as client,
                client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=self._payload(messages, options, stream=True),
                ) as resp,
            ):
                if resp.status_code >= 400:
                    body = (await resp.aread()).decode("utf-8", errors="replace")[:400]
                    raise httpx.HTTPStatusError(
                        f"OpenRouter stream failed: {body}",
                        request=resp.request,
                        response=resp,
                    )
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith(":"):
                        continue
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if not data or data == "[DONE]":
                        if data == "[DONE]":
                            break
                        continue
                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        logger.debug("Skipping non-JSON OpenRouter chunk: %s", data[:80])
                        continue
                    if chunk.get("error"):
                        err = chunk["error"]
                        msg = err.get("message") if isinstance(err, dict) else str(err)
                        yield StreamEvent(
                            type="error",
                            error_code="PROVIDER_ERROR",
                            error_message=msg or "OpenRouter stream error",
                        )
                        return
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    text = delta.get("content") or ""
                    if text:
                        yield StreamEvent(type="token", text=text)
            yield StreamEvent(type="done")
        except AppError as exc:
            yield StreamEvent(type="error", error_code=exc.code, error_message=exc.message)
        except Exception as exc:  # noqa: BLE001
            mapped = self._map_error(exc)
            yield StreamEvent(
                type="error",
                error_code=mapped.code,
                error_message=mapped.message,
            )

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
