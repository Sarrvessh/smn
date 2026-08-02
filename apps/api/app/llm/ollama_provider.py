from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import httpx
from pydantic import BaseModel

from app.core.config import get_settings
from app.core.errors import (
    OLLAMA_MODEL_MISSING,
    OLLAMA_UNAVAILABLE,
    PROVIDER_TIMEOUT,
    AppError,
)
from app.llm.base import (
    ChatMessage,
    EmbeddingProvider,
    GenerationOptions,
    GenerationResult,
    LLMProvider,
    ProviderHealth,
    StreamEvent,
)

logger = logging.getLogger(__name__)


class OllamaProvider:
    id = "ollama"

    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.ollama_base_url.rstrip("/")

    async def healthcheck(self) -> ProviderHealth:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                models = [m.get("name", "") for m in resp.json().get("models", [])]
                return ProviderHealth(
                    id=self.id,
                    configured=True,
                    healthy=True,
                    models=models,
                )
        except Exception as exc:  # noqa: BLE001
            return ProviderHealth(
                id=self.id,
                configured=True,
                healthy=False,
                models=[],
                detail=str(exc),
            )

    def _map_error(self, exc: Exception, model: str | None = None) -> AppError:
        model_name = model or self.settings.ollama_chat_model
        if isinstance(exc, httpx.ConnectError):
            return AppError(
                OLLAMA_UNAVAILABLE,
                "Ollama is not running. Start Ollama and retry.",
                retryable=True,
                status_code=503,
            )
        if isinstance(exc, httpx.TimeoutException):
            return AppError(
                PROVIDER_TIMEOUT,
                "Ollama request timed out.",
                retryable=True,
                status_code=504,
            )
        msg = str(exc)
        lowered = msg.lower()
        if (
            "400" in lowered
            or "not found" in lowered
            or "pull" in lowered
            or "model" in lowered
            and "missing" in lowered
        ):
            return AppError(
                OLLAMA_MODEL_MISSING,
                f"Ollama rejected model '{model_name}'. "
                f"Select an installed model in the header, or run: ollama pull {model_name}",
                retryable=False,
                status_code=400,
            )
        return AppError(OLLAMA_UNAVAILABLE, msg, retryable=True, status_code=503)

    def _payload(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
        *,
        stream: bool,
    ) -> dict:
        payload = {
            "model": options.model or self.settings.ollama_chat_model,
            "messages": [message.model_dump() for message in messages],
            "stream": stream,
            "options": {"temperature": options.temperature},
        }
        if options.max_tokens is not None:
            payload["options"]["num_predict"] = options.max_tokens
        if options.stop:
            payload["options"]["stop"] = options.stop
        return payload

    async def generate(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> GenerationResult:
        model = options.model or self.settings.ollama_chat_model
        payload = self._payload(messages, options, stream=False)
        try:
            async with httpx.AsyncClient(
                timeout=self.settings.llm_request_timeout_seconds
            ) as client:
                resp = await client.post(f"{self.base_url}/api/chat", json=payload)
                if resp.status_code in {400, 404}:
                    detail = ""
                    try:
                        detail = resp.json().get("error", resp.text)
                    except Exception:  # noqa: BLE001
                        detail = resp.text
                    raise AppError(
                        OLLAMA_MODEL_MISSING,
                        f"Ollama rejected model '{model}'"
                        + (f": {detail}" if detail else "")
                        + f". Select an installed model, or run: ollama pull {model}",
                        retryable=False,
                        status_code=400,
                    )
                resp.raise_for_status()
                data = resp.json()
                text = data.get("message", {}).get("content", "")
                return GenerationResult(text=text, model=model, provider=self.id, raw=data)
        except AppError:
            raise
        except Exception as exc:
            raise self._map_error(exc, model) from exc

    async def stream(
        self,
        messages: list[ChatMessage],
        options: GenerationOptions,
    ) -> AsyncIterator[StreamEvent]:
        model = options.model or self.settings.ollama_chat_model
        payload = self._payload(messages, options, stream=True)
        try:
            async with (
                httpx.AsyncClient(timeout=self.settings.llm_request_timeout_seconds) as client,
                client.stream("POST", f"{self.base_url}/api/chat", json=payload) as resp,
            ):
                if resp.status_code in {400, 404}:
                    detail = ""
                    try:
                        detail = (await resp.aread()).decode("utf-8", errors="replace")
                    except Exception:  # noqa: BLE001
                        detail = ""
                    yield StreamEvent(
                        type="error",
                        error_code=OLLAMA_MODEL_MISSING,
                        error_message=(
                            f"Ollama rejected model '{model}'"
                            + (f": {detail}" if detail else "")
                            + f". Select an installed model, or run: ollama pull {model}"
                        ),
                    )
                    return
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    data = json.loads(line)
                    content = data.get("message", {}).get("content", "")
                    if content:
                        yield StreamEvent(type="token", text=content)
                    if data.get("done"):
                        yield StreamEvent(type="done")
                        return
        except Exception as exc:  # noqa: BLE001
            err = self._map_error(exc, model)
            yield StreamEvent(type="error", error_code=err.code, error_message=err.message)

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
        try:
            return schema.model_validate_json(text)
        except Exception:
            # Fallback: try to extract first JSON object
            start = text.find("{")
            end = text.rfind("}")
            if start >= 0 and end > start:
                return schema.model_validate_json(text[start : end + 1])
            raise


class OllamaEmbeddingProvider:
    def __init__(self) -> None:
        self.settings = get_settings()
        self.base_url = self.settings.ollama_base_url.rstrip("/")
        self.model = self.settings.ollama_embed_model

    async def _embed(self, text: str) -> list[float]:
        async with httpx.AsyncClient(timeout=self.settings.llm_request_timeout_seconds) as client:
            resp = await client.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.model, "prompt": text},
            )
            resp.raise_for_status()
            return list(resp.json()["embedding"])

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for text in texts:
            vectors.append(await self._embed(text))
        return vectors

    async def embed_query(self, text: str) -> list[float]:
        return await self._embed(text)


# Typing helpers for protocol checks
_: LLMProvider = OllamaProvider()  # type: ignore[assignment]
__: EmbeddingProvider = OllamaEmbeddingProvider()  # type: ignore[assignment]
