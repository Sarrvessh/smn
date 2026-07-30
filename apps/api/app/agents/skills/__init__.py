from __future__ import annotations

from pathlib import Path

from app.agents.schemas import ArtifactResult, QAResult, RouteDecision, Ship30Result
from app.llm.base import ChatMessage, GenerationOptions
from app.llm.registry import registry
from app.retrieval.hybrid_search import RetrievedChunk, format_evidence, should_abstain

# apps/api/app/agents/skills/__init__.py → repo root is parents[5]
ROOT = Path(__file__).resolve().parents[5]
SKILLS = ROOT / "skills"

ABSTAIN = (
    "I could not find enough relevant support for that question "
    "in the indexed Lenny’s Podcast transcripts."
)


def _read_prompt(skill_dir: str, name: str = "prompt.md") -> str:
    path = SKILLS / skill_dir / name
    if path.exists():
        return path.read_text(encoding="utf-8")
    return ""


async def run_transcript_qa(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[ChatMessage],
    provider: str,
    model: str | None,
) -> QAResult:
    if should_abstain(chunks):
        return QAResult(answer_markdown=ABSTAIN, source_ids=[], confidence=0.1)

    evidence = format_evidence(chunks)
    system = _read_prompt("transcript-qa")
    messages = [
        ChatMessage(role="system", content=system),
        *history[-10:],
        ChatMessage(
            role="user",
            content=f"Question:\n{question}\n\nEvidence:\n{evidence}",
        ),
    ]
    llm = registry.get_llm(provider)
    # Prefer plain generation for reliability with small local models.
    gen = await llm.generate(messages, GenerationOptions(model=model, temperature=0.2))
    return QAResult(
        answer_markdown=gen.text,
        source_ids=[c.citation_label for c in chunks],
        confidence=0.5,
    )


async def iter_transcript_qa(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[ChatMessage],
    provider: str,
    model: str | None,
):
    """Yield markdown text chunks as the model streams."""
    if should_abstain(chunks):
        yield ABSTAIN
        return

    evidence = format_evidence(chunks)
    system = _read_prompt("transcript-qa")
    messages = [
        ChatMessage(role="system", content=system),
        *history[-10:],
        ChatMessage(
            role="user",
            content=(
                f"Question:\n{question}\n\nEvidence:\n{evidence}\n\n"
                "Write a well-structured Markdown answer with these exact headings "
                "on their own lines:\n"
                "### Direct answer\n"
                "### Key insights\n"
                "### Practical recommendation\n"
                "### Sources\n\n"
                "Use blank lines between sections. Use a bullet list under Key insights. "
                "Cite sources as [S1], [S2], etc."
            ),
        ),
    ]
    llm = registry.get_llm(provider)
    async for event in llm.stream(messages, GenerationOptions(model=model, temperature=0.2)):
        if event.type == "token" and event.text:
            yield event.text
        elif event.type == "error":
            from app.core.errors import AppError

            raise AppError(
                event.error_code or "OLLAMA_UNAVAILABLE",
                event.error_message or "Generation failed",
                retryable=True,
                status_code=502,
            )



async def run_ship30(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[ChatMessage],
    provider: str,
    model: str | None,
) -> Ship30Result:
    evidence = format_evidence(chunks) if chunks else "No transcript passages retrieved."
    system = _read_prompt("ship30") + "\n\n" + _read_prompt("ship30", "style-guide.md")
    messages = [
        ChatMessage(role="system", content=system),
        *history[-8:],
        ChatMessage(role="user", content=f"Request:\n{question}\n\nEvidence:\n{evidence}"),
    ]
    llm = registry.get_llm(provider)
    # Prefer plain generation for local models; structured JSON is unreliable on small LLMs.
    try:
        gen = await llm.generate(
            messages
            + [
                ChatMessage(
                    role="user",
                    content=(
                        "Respond with the essay markdown only. Start with a clear H1 title."
                    ),
                )
            ],
            GenerationOptions(model=model, temperature=0.4, max_tokens=8192),
        )
        words = gen.text.split()
        first_line = (
            gen.text.strip().splitlines()[0].lstrip("# ").strip() if gen.text.strip() else "Ship30 Essay"
        )
        return Ship30Result(
            title=first_line[:120] or "Ship30 Essay",
            markdown=gen.text,
            source_ids=[c.citation_label for c in chunks],
            estimated_word_count=len(words),
        )
    except Exception:  # noqa: BLE001
        result = await llm.generate_structured(
            messages, Ship30Result, GenerationOptions(model=model, temperature=0.4, max_tokens=8192)
        )
        assert isinstance(result, Ship30Result)
        if not result.estimated_word_count:
            result.estimated_word_count = len(result.markdown.split())
        return result


async def run_artifact(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[ChatMessage],
    provider: str,
    model: str | None,
    artifact_type: str | None,
) -> ArtifactResult:
    evidence = format_evidence(chunks) if chunks else ""
    want_html = (artifact_type or "markdown") == "html"
    system = _read_prompt("artifact")
    messages = [
        ChatMessage(role="system", content=system),
        *history[-8:],
        ChatMessage(
            role="user",
            content=(
                f"Request:\n{question}\n\nPreferred type: {'html' if want_html else 'markdown'}\n\n"
                f"Evidence:\n{evidence}"
            ),
        ),
    ]
    llm = registry.get_llm(provider)
    # Prefer plain generation; wrap into ArtifactResult locally.
    try:
        gen = await llm.generate(
            messages
            + [
                ChatMessage(
                    role="user",
                    content=(
                        "Return only the artifact body. "
                        + (
                            "Use a complete HTML document with inline CSS and no scripts."
                            if want_html
                            else "Use Markdown."
                        )
                    ),
                )
            ],
            GenerationOptions(model=model, temperature=0.3, max_tokens=8192),
        )
        if want_html:
            content = gen.text
            if "<html" not in content.lower():
                content = (
                    "<!DOCTYPE html><html><head><style>"
                    "body{font-family:system-ui;padding:2rem;background:#f7f4ef;color:#1a1a1a}"
                    "h1{font-size:1.6rem} .card{margin:1rem 0;padding:1rem;border:1px solid #ddd}"
                    "</style></head><body>"
                    f"<h1>Growth Artifact</h1><div class='card'>{gen.text}</div></body></html>"
                )
            return ArtifactResult(
                title="Generated HTML Artifact",
                artifact_type="html",
                language="html",
                content=content,
                source_ids=[c.citation_label for c in chunks],
                summary="HTML artifact",
            )
        return ArtifactResult(
            title="Generated Markdown Artifact",
            artifact_type="markdown",
            language="markdown",
            content=gen.text,
            source_ids=[c.citation_label for c in chunks],
            summary="Markdown artifact",
        )
    except Exception:  # noqa: BLE001
        result = await llm.generate_structured(
            messages, ArtifactResult, GenerationOptions(model=model, temperature=0.3, max_tokens=8192)
        )
        assert isinstance(result, ArtifactResult)
        return result


# Re-export for router convenience
__all__ = [
    "ABSTAIN",
    "RouteDecision",
    "iter_transcript_qa",
    "run_artifact",
    "run_ship30",
    "run_transcript_qa",
]
