from app.core.config import Settings
from app.llm.base import ChatMessage, GenerationOptions
from app.llm.openrouter_provider import OpenRouterProvider
from app.llm.registry import default_chat_model


def test_default_chat_model_per_provider():
    settings = Settings(
        ollama_chat_model="qwen2.5:7b",
        anthropic_model="claude-sonnet-4-20250514",
        openrouter_model="google/gemini-2.5-flash",
    )
    assert default_chat_model("ollama", settings) == "qwen2.5:7b"
    assert default_chat_model("anthropic", settings) == "claude-sonnet-4-20250514"
    assert default_chat_model("openrouter", settings) == "google/gemini-2.5-flash"
    assert default_chat_model(None, settings) == "qwen2.5:7b"


def test_openrouter_configured_models_dedupes_default():
    settings = Settings(
        openrouter_api_key="sk-test",
        openrouter_model="openai/gpt-4o-mini",
        openrouter_models="google/gemini-2.5-flash,openai/gpt-4o-mini",
    )
    provider = OpenRouterProvider()
    provider.settings = settings
    models = provider._configured_models()
    assert models[0] == "openai/gpt-4o-mini"
    assert models.count("openai/gpt-4o-mini") == 1
    assert "google/gemini-2.5-flash" in models


def test_openrouter_payload_includes_system_role():
    settings = Settings(openrouter_api_key="sk-test", openrouter_model="openai/gpt-4o-mini")
    provider = OpenRouterProvider()
    provider.settings = settings
    payload = provider._payload(
        [
            ChatMessage(role="system", content="Be concise."),
            ChatMessage(role="user", content="Hello"),
        ],
        GenerationOptions(model="openai/gpt-4o-mini", temperature=0.1, max_tokens=128),
        stream=True,
    )
    assert payload["stream"] is True
    assert payload["model"] == "openai/gpt-4o-mini"
    assert payload["messages"][0]["role"] == "system"
    assert payload["max_tokens"] == 128
