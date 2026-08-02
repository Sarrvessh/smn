from types import SimpleNamespace

import pytest

from app.agents.skills import run_artifact
from app.core.errors import STREAM_INTERRUPTED, AppError
from app.services.conversation import _mark_cancelled


class FakeDb:
    def __init__(self) -> None:
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1


async def test_mark_cancelled_persists_partial_text_and_terminal_states():
    db = FakeDb()
    message = SimpleNamespace(status="streaming", error_code=None, content="")
    run = SimpleNamespace(status="running", error_code=None, duration_ms=None)

    await _mark_cancelled(db, message, run, started=0.0, partial_text="Partial answer")

    assert message.status == "cancelled"
    assert message.error_code == STREAM_INTERRUPTED
    assert message.content == "Partial answer"
    assert run.status == "cancelled"
    assert run.error_code == STREAM_INTERRUPTED
    assert run.duration_ms >= 0
    assert db.commits == 1


async def test_mark_cancelled_does_not_overwrite_completed_run():
    db = FakeDb()
    message = SimpleNamespace(status="completed", error_code=None, content="Done")
    run = SimpleNamespace(status="completed", error_code=None, duration_ms=10)

    await _mark_cancelled(db, message, run, started=0.0, partial_text="Partial")

    assert message.content == "Done"
    assert db.commits == 0


async def test_artifact_generation_does_not_retry_provider_failures(monkeypatch):
    class FailingProvider:
        structured_called = False

        async def generate(self, _messages, _options):
            raise AppError(
                "PROVIDER_TIMEOUT",
                "Provider timed out",
                retryable=True,
                status_code=504,
            )

        async def generate_structured(self, _messages, _schema, _options):
            self.structured_called = True
            raise AssertionError("provider failure should not trigger a second request")

    provider = FailingProvider()
    monkeypatch.setattr(
        "app.agents.skills.registry.get_llm",
        lambda _provider_name: provider,
    )

    with pytest.raises(AppError, match="Provider timed out"):
        await run_artifact(
            "Create a markdown plan",
            [],
            [],
            "ollama",
            "qwen2.5:7b",
            "markdown",
        )

    assert provider.structured_called is False
