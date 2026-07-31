from __future__ import annotations

from app.core.config import Settings, get_settings
from app.core.errors import PROVIDER_NOT_CONFIGURED, AppError
from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import EmbeddingProvider, LLMProvider
from app.llm.hash_embeddings import HashEmbeddingProvider
from app.llm.ollama_provider import OllamaEmbeddingProvider, OllamaProvider
from app.llm.openrouter_provider import OpenRouterProvider


def default_chat_model(provider: str | None, settings: Settings | None = None) -> str:
    """Resolve the default chat model for a generation provider."""
    cfg = settings or get_settings()
    name = (provider or cfg.default_llm_provider).lower()
    if name == "anthropic":
        return cfg.anthropic_model
    if name == "openrouter":
        return cfg.openrouter_model
    return cfg.ollama_chat_model


class ProviderRegistry:
    def __init__(self) -> None:
        self._ollama = OllamaProvider()
        self._anthropic = AnthropicProvider()
        self._openrouter = OpenRouterProvider()
        self._embed_ollama = OllamaEmbeddingProvider()
        self._embed_hash = HashEmbeddingProvider()

    def get_llm(self, provider: str | None = None) -> LLMProvider:
        settings = get_settings()
        name = (provider or settings.default_llm_provider).lower()
        if name == "ollama":
            return self._ollama
        if name == "anthropic":
            if not settings.anthropic_api_key:
                raise AppError(
                    PROVIDER_NOT_CONFIGURED,
                    "Anthropic is not configured. Add ANTHROPIC_API_KEY or switch to Ollama / OpenRouter.",
                    retryable=False,
                    status_code=400,
                )
            return self._anthropic
        if name == "openrouter":
            if not settings.openrouter_api_key:
                raise AppError(
                    PROVIDER_NOT_CONFIGURED,
                    "OpenRouter is not configured. Add OPENROUTER_API_KEY or switch provider.",
                    retryable=False,
                    status_code=400,
                )
            return self._openrouter
        raise AppError(PROVIDER_NOT_CONFIGURED, f"Unknown provider: {name}", retryable=False)

    def get_embeddings(self) -> EmbeddingProvider:
        settings = get_settings()
        model = (settings.ollama_embed_model or "").lower()
        if model in {"hash", "local-hash", "deterministic"}:
            return self._embed_hash
        return self._embed_ollama

    async def health(self) -> dict:
        ollama = await self._ollama.healthcheck()
        anthropic = await self._anthropic.healthcheck()
        openrouter = await self._openrouter.healthcheck()

        def chat_models(models: list[str]) -> list[str]:
            chat = [
                m
                for m in models
                if not any(x in m.lower() for x in ("embed", "embedding", "bge-", "minilm"))
            ]
            return chat or models

        return {
            "providers": [
                {
                    "id": ollama.id,
                    "configured": ollama.configured,
                    "healthy": ollama.healthy,
                    "models": chat_models(ollama.models),
                },
                {
                    "id": anthropic.id,
                    "configured": anthropic.configured,
                    "healthy": anthropic.healthy,
                    "models": anthropic.models,
                },
                {
                    "id": openrouter.id,
                    "configured": openrouter.configured,
                    "healthy": openrouter.healthy,
                    "models": openrouter.models,
                },
            ]
        }


registry = ProviderRegistry()
