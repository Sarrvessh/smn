from __future__ import annotations

from pathlib import Path

from app.agents.schemas import ArtifactResult, QAResult, RouteDecision, Ship30Result
from app.agents.source_appendix import (
    citation_labels_outside_sources,
    ensure_html_source_appendix,
    ensure_markdown_source_appendix,
)
from app.core.errors import OLLAMA_MODEL_MISSING, PROVIDER_NOT_CONFIGURED, AppError
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


def _extract_md_title(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            title = stripped[2:].strip()
            return title or None
    return None


def _extract_html_title(text: str) -> str | None:
    lower = text.lower()
    for tag in ("<h1", "<title"):
        start = lower.find(tag)
        if start < 0:
            continue
        gt = text.find(">", start)
        if gt < 0:
            continue
        end_tag = "</h1>" if tag == "<h1" else "</title>"
        end = lower.find(end_tag, gt)
        if end < 0:
            continue
        title = text[gt + 1 : end].strip()
        # Strip simple nested tags if any
        if "<" in title:
            continue
        return title or None
    return None


async def run_transcript_qa(
    question: str,
    chunks: list[RetrievedChunk],
    history: list[ChatMessage],
    provider: str,
    model: str | None,
    *,
    intent: str = "direct",
    scoped_missing: bool = False,
) -> QAResult:
    if should_abstain(chunks, intent=intent, scoped_missing=scoped_missing):
        return QAResult(answer_markdown=ABSTAIN, source_ids=[], confidence=0.1)

    evidence = format_evidence(chunks)
    system = _read_prompt("transcript-qa")
    messages = [
        ChatMessage(role="system", content=system),
        *history[-10:],
        ChatMessage(
            role="user",
            content=(
                f"Question:\n{question}\n\n"
                f"Evidence:\n{evidence}\n\n"
                "Answer using only this Evidence. Cite claims with [S#]. "
                "If Evidence is insufficient, abstain with the exact abstain sentence."
            ),
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
    *,
    intent: str = "direct",
    scoped_missing: bool = False,
):
    """Yield markdown text chunks as the model streams."""
    if should_abstain(chunks, intent=intent, scoped_missing=scoped_missing):
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
                f"Question:\n{question}\n\n"
                f"Evidence:\n{evidence}\n\n"
                "Follow the system output contract exactly.\n"
                "Use only this Evidence. Cite with [S#]. "
                "If Evidence cannot support the question (including a missing requested guest/episode), "
                "abstain with the exact abstain sentence and nothing else.\n\n"
                "Required Markdown headings (each on its own line, blank line after each heading):\n"
                "### Direct answer\n"
                "### Key insights\n"
                "### Practical recommendation\n"
                "### Sources\n\n"
                "Key insights must be a bullet list. Sources must list only cited [S#] rows."
            ),
        ),
    ]
    llm = registry.get_llm(provider)
    async for event in llm.stream(messages, GenerationOptions(model=model, temperature=0.2)):
        if event.type == "token" and event.text:
            yield event.text
        elif event.type == "error":
            code = event.error_code or "PROVIDER_ERROR"
            retryable = code not in {PROVIDER_NOT_CONFIGURED, OLLAMA_MODEL_MISSING}
            raise AppError(
                code,
                event.error_message or "Generation failed",
                retryable=retryable,
                status_code=502 if retryable else 400,
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
        ChatMessage(
            role="user",
            content=(
                f"Request:\n{question}\n\n"
                f"Evidence:\n{evidence}\n\n"
                "Write a Ship30for30 Markdown essay for one specific reader, grounded only in Evidence. "
                "Cite with [S#]. Prefer paraphrase; use direct quotes only when they are exact, short, "
                "and visibly present in the cited passage. Target ~1100–1400 words.\n\n"
                "Required H2 sections in order after the H1 title:\n"
                "The hook; The problem; Why common advice fails; What the evidence shows; "
                "A practical framework; What to do next; The takeaway; Sources.\n\n"
                "The Sources section must include guest, episode, chunk id, URL, and a short excerpt "
                "for every cited [S#]. Respond with the essay Markdown only. Start with a clear H1 title. "
                "No preamble, no JSON, no code fence around the essay."
            ),
        ),
    ]
    llm = registry.get_llm(provider)
    # Prefer plain generation for local models; structured JSON is unreliable on small LLMs.
    try:
        gen = await llm.generate(
            messages,
            GenerationOptions(model=model, temperature=0.4, max_tokens=8192),
        )
        markdown_cites = citation_labels_outside_sources(gen.text, "markdown")
        markdown = ensure_markdown_source_appendix(gen.text, chunks, markdown_cites)
        words = markdown.split()
        first_line = (
            markdown.strip().splitlines()[0].lstrip("# ").strip()
            if markdown.strip()
            else "Ship30 Essay"
        )
        return Ship30Result(
            title=first_line[:120] or "Ship30 Essay",
            markdown=markdown,
            source_ids=[c.citation_label for c in chunks],
            estimated_word_count=len(words),
        )
    except AppError:
        raise
    except Exception:  # noqa: BLE001
        result = await llm.generate_structured(
            messages, Ship30Result, GenerationOptions(model=model, temperature=0.4, max_tokens=8192)
        )
        assert isinstance(result, Ship30Result)
        markdown_cites = citation_labels_outside_sources(result.markdown, "markdown")
        result.markdown = ensure_markdown_source_appendix(result.markdown, chunks, markdown_cites)
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
    type_label = "html" if want_html else "markdown"
    body_rules = (
        "Return ONLY a complete HTML5 document with inline <style> CSS. "
        "No scripts, event handlers, forms, iframes, foreignObject, or external CSS/JS/fonts/images. "
        "REQUIRED: include at least two visual elements using inline SVG and/or CSS charts "
        "(KPI metric cards, bar chart, line/area chart, donut, or funnel diagram). "
        "Label charts; if numbers are illustrative, caption them as a working template. "
        "Include a real <h1>, useful sections, and a Sources section if Evidence was used. "
        "Sources must include [S#], guest, episode, chunk id, URL, and a short excerpt. "
        "Prefer paraphrase; use direct quotes only when exact, short, and visibly present in Evidence. "
        "No markdown fences, no commentary before/after the HTML."
        if want_html
        else "Return ONLY Markdown (raw document body). "
        "Start with an H1 title, clear ## sections, at least one checklist or numbered plan, "
        "and include a table or ASCII chart when comparing magnitudes. "
        "Add ## Sources with [S#], guest, episode, chunk id, URL, and a short excerpt when Evidence was used. "
        "Prefer paraphrase; use direct quotes only when exact, short, and visibly present in Evidence. "
        "No preamble, no JSON, no wrapping code fence."
    )
    messages = [
        ChatMessage(role="system", content=system),
        *history[-8:],
        ChatMessage(
            role="user",
            content=(
                f"Request:\n{question}\n\n"
                f"Preferred type: {type_label}\n\n"
                f"Evidence:\n{evidence or '(none retrieved — do not invent transcript attributions)'}\n\n"
                f"{body_rules}"
            ),
        ),
    ]
    llm = registry.get_llm(provider)
    # Prefer plain generation; wrap into ArtifactResult locally.
    try:
        gen = await llm.generate(
            messages,
            GenerationOptions(model=model, temperature=0.3, max_tokens=8192),
        )
        if want_html:
            content = gen.text.strip()
            # Strip accidental markdown fences around HTML
            if content.startswith("```"):
                content = content.strip("`")
                if content.lower().startswith("html"):
                    content = content[4:].lstrip()
                if content.endswith("```"):
                    content = content[:-3].rstrip()
            if "<html" not in content.lower():
                content = (
                    "<!DOCTYPE html><html lang='en'><head><meta charset='UTF-8' />"
                    "<meta name='viewport' content='width=device-width, initial-scale=1' />"
                    "<title>Growth Artifact</title><style>"
                    "body{font-family:system-ui,sans-serif;padding:2rem;background:#f7f7f8;color:#111118;"
                    "line-height:1.5;max-width:960px;margin:0 auto}"
                    "h1{font-size:1.6rem;margin:0 0 .5rem}.card{margin:1rem 0;padding:1rem;"
                    "border:1px solid #e4e4e7;border-radius:12px;background:#fff}"
                    "</style></head><body>"
                    f"<h1>Growth Artifact</h1><div class='card'>{gen.text}</div></body></html>"
                )
            html_cites = citation_labels_outside_sources(content, "html")
            content = ensure_html_source_appendix(content, chunks, html_cites)
            title = _extract_html_title(content) or "Generated HTML Artifact"
            return ArtifactResult(
                title=title[:120],
                artifact_type="html",
                language="html",
                content=content,
                source_ids=[c.citation_label for c in chunks],
                summary="HTML artifact grounded in transcript evidence"
                if chunks
                else "HTML artifact",
            )
        md = gen.text.strip()
        if md.startswith("```"):
            md = md.strip("`")
            if md.lower().startswith("markdown"):
                md = md[8:].lstrip()
            elif md.lower().startswith("md"):
                md = md[2:].lstrip()
        md_cites = citation_labels_outside_sources(md, "markdown")
        md = ensure_markdown_source_appendix(md, chunks, md_cites)
        title = _extract_md_title(md) or "Generated Markdown Artifact"
        return ArtifactResult(
            title=title[:120],
            artifact_type="markdown",
            language="markdown",
            content=md,
            source_ids=[c.citation_label for c in chunks],
            summary="Markdown artifact grounded in transcript evidence"
            if chunks
            else "Markdown artifact",
        )
    except AppError:
        raise
    except Exception:  # noqa: BLE001
        result = await llm.generate_structured(
            messages,
            ArtifactResult,
            GenerationOptions(model=model, temperature=0.3, max_tokens=8192),
        )
        assert isinstance(result, ArtifactResult)
        if result.artifact_type == "html":
            html_cites = citation_labels_outside_sources(result.content, "html")
            result.content = ensure_html_source_appendix(result.content, chunks, html_cites)
        else:
            md_cites = citation_labels_outside_sources(result.content, "markdown")
            result.content = ensure_markdown_source_appendix(result.content, chunks, md_cites)
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
