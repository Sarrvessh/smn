from app.core.config import Settings
from app.llm.anthropic_provider import AnthropicProvider
from app.llm.base import ChatMessage, GenerationOptions, ProviderHealth
from app.llm.ollama_provider import OllamaProvider
from app.llm.openrouter_provider import OpenRouterProvider
from app.llm.registry import ProviderRegistry, default_chat_model


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


def test_anthropic_client_uses_shared_timeout_and_retries():
    settings = Settings(
        anthropic_api_key="sk-ant-test",
        llm_request_timeout_seconds=123,
        llm_max_retries=4,
    )
    provider = AnthropicProvider()
    provider.settings = settings

    client = provider._client()

    assert client.timeout.read == 123
    assert client.timeout.connect == 10
    assert client.max_retries == 4


def test_anthropic_request_kwargs_translate_options():
    settings = Settings(
        anthropic_api_key="sk-ant-test",
        anthropic_model="claude-sonnet-4-20250514",
    )
    provider = AnthropicProvider()
    provider.settings = settings

    kwargs = provider._request_kwargs(
        [
            ChatMessage(role="system", content="Be concise."),
            ChatMessage(role="assistant", content="stale leading assistant"),
            ChatMessage(role="user", content="Hello"),
            ChatMessage(role="user", content="Follow-up detail"),
            ChatMessage(role="assistant", content="Answer draft"),
        ],
        GenerationOptions(
            model="claude-3-5-haiku-20241022",
            temperature=0.1,
            max_tokens=128,
            stop=["STOP"],
        ),
    )

    assert kwargs["model"] == "claude-3-5-haiku-20241022"
    assert kwargs["system"] == "Be concise."
    assert kwargs["max_tokens"] == 128
    assert kwargs["temperature"] == 0.1
    assert kwargs["stop_sequences"] == ["STOP"]
    assert kwargs["messages"] == [
        {"role": "user", "content": "Hello\n\nFollow-up detail"},
        {"role": "assistant", "content": "Answer draft"},
    ]


def test_ollama_payload_translates_generation_options():
    settings = Settings(ollama_chat_model="qwen2.5:7b")
    provider = OllamaProvider()
    provider.settings = settings

    payload = provider._payload(
        [ChatMessage(role="user", content="Hello")],
        GenerationOptions(temperature=0.1, max_tokens=64, stop=["STOP"]),
        stream=True,
    )

    assert payload["model"] == "qwen2.5:7b"
    assert payload["stream"] is True
    assert payload["options"] == {
        "temperature": 0.1,
        "num_predict": 64,
        "stop": ["STOP"],
    }


async def test_anthropic_health_verifies_credentials_and_lists_models(monkeypatch):
    class FakeModels:
        async def list(self, *, limit):
            assert limit == 100
            return type("Page", (), {"data": [type("Model", (), {"id": "claude-test"})()]})()

    fake_client = type("Client", (), {"models": FakeModels()})()
    provider = AnthropicProvider()
    provider.settings = Settings(
        anthropic_api_key="sk-ant-test",
        anthropic_model="claude-selected",
    )
    monkeypatch.setattr(provider, "_client", lambda **_kwargs: fake_client)

    health = await provider.healthcheck()

    assert health.configured is True
    assert health.healthy is True
    assert health.models == ["claude-selected", "claude-test"]


async def test_provider_health_never_exposes_embedding_models(monkeypatch):
    registry = ProviderRegistry()

    async def ollama_health():
        return ProviderHealth(
            id="ollama",
            configured=True,
            healthy=True,
            models=["embeddinggemma:latest", "qwen2.5:7b"],
        )

    async def anthropic_health():
        return ProviderHealth(id="anthropic", configured=False, healthy=False)

    async def openrouter_health():
        return ProviderHealth(id="openrouter", configured=False, healthy=False)

    monkeypatch.setattr(registry._ollama, "healthcheck", ollama_health)
    monkeypatch.setattr(registry._anthropic, "healthcheck", anthropic_health)
    monkeypatch.setattr(registry._openrouter, "healthcheck", openrouter_health)

    result = await registry.health()

    assert result["providers"][0]["models"] == ["qwen2.5:7b"]
