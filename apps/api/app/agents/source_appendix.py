from __future__ import annotations

import html
import re

from app.retrieval.citations import extract_citations
from app.retrieval.hybrid_search import RetrievedChunk

MD_SOURCES_RE = re.compile(r"(?ims)(?:^|\n)##\s+Sources\s*\n.*\Z")
HTML_SOURCES_SECTION_RE = re.compile(
    r"""(?is)<section\b[^>]*(?:id=["']sources["']|aria-labelledby=["']sources-title["'])[^>]*>.*?</section>"""
)
HTML_SOURCES_HEADING_RE = re.compile(
    r"(?is)<h2\b[^>]*>\s*Sources\s*</h2>.*?(?=</body\s*>|</html\s*>|\Z)"
)
BODY_CLOSE_RE = re.compile(r"(?i)</body\s*>")


def _label(chunk: RetrievedChunk, index: int) -> str:
    if not chunk.citation_label:
        chunk.citation_label = f"S{index}"
    return chunk.citation_label


def _compact_excerpt(text: str, limit: int = 260) -> str:
    excerpt = re.sub(r"\s+", " ", text).strip()
    if len(excerpt) <= limit:
        return excerpt
    return excerpt[: limit - 1].rstrip() + "..."


def _unique_in_order(labels: list[str]) -> list[str]:
    seen: set[str] = set()
    ordered: list[str] = []
    for label in labels:
        if label in seen:
            continue
        seen.add(label)
        ordered.append(label)
    return ordered


def strip_markdown_sources(content: str) -> str:
    match = MD_SOURCES_RE.search(content.rstrip())
    if not match:
        return content.rstrip()
    return content[: match.start()].rstrip()


def strip_html_sources(content: str) -> str:
    stripped = HTML_SOURCES_SECTION_RE.sub("", content)
    stripped = HTML_SOURCES_HEADING_RE.sub("", stripped)
    return stripped.rstrip()


def citation_labels_outside_sources(content: str, artifact_type: str) -> list[str]:
    body = strip_html_sources(content) if artifact_type == "html" else strip_markdown_sources(content)
    return _unique_in_order(extract_citations(body))


def _select_chunks(
    chunks: list[RetrievedChunk], citation_labels: list[str] | set[str] | None
) -> list[RetrievedChunk]:
    for i, chunk in enumerate(chunks, start=1):
        _label(chunk, i)
    if citation_labels is None:
        return chunks
    wanted = set(citation_labels)
    return [chunk for chunk in chunks if chunk.citation_label in wanted]


def format_markdown_source_appendix(chunks: list[RetrievedChunk]) -> str:
    lines = ["## Sources", ""]
    for i, chunk in enumerate(chunks, start=1):
        label = _label(chunk, i)
        published = chunk.publish_date or "unknown date"
        url = chunk.source_url or "n/a"
        lines.extend(
            [
                f"- [{label}] {chunk.guest} - {chunk.episode_title}",
                f"  - Published: {published}",
                f"  - Chunk: `{chunk.chunk_id}`",
                f"  - URL: {url}",
                f"  - Excerpt: {_compact_excerpt(chunk.content)}",
            ]
        )
    return "\n".join(lines).rstrip()


def ensure_markdown_source_appendix(
    content: str,
    chunks: list[RetrievedChunk],
    citation_labels: list[str] | set[str] | None = None,
) -> str:
    if not chunks:
        return content

    selected = _select_chunks(chunks, citation_labels)
    body = strip_markdown_sources(content)
    if not selected:
        return body
    appendix = format_markdown_source_appendix(selected)
    if body:
        return f"{body}\n\n{appendix}"
    return appendix


def format_html_source_appendix(chunks: list[RetrievedChunk]) -> str:
    items: list[str] = []
    for i, chunk in enumerate(chunks, start=1):
        label = _label(chunk, i)
        published = chunk.publish_date or "unknown date"
        url = chunk.source_url or "n/a"
        items.append(
            "<li>"
            f"<strong>[{html.escape(label)}] {html.escape(chunk.guest)} - "
            f"{html.escape(chunk.episode_title)}</strong>"
            "<br />"
            f"<span>Published: {html.escape(published)} | "
            f"Chunk: {html.escape(str(chunk.chunk_id))}</span>"
            "<br />"
            f"<span>URL: {html.escape(url)}</span>"
            "<br />"
            f"<span>Excerpt: {html.escape(_compact_excerpt(chunk.content))}</span>"
            "</li>"
        )

    return (
        '<section id="sources" aria-labelledby="sources-title">'
        '<h2 id="sources-title">Sources</h2>'
        "<ol>"
        + "".join(items)
        + "</ol>"
        "</section>"
    )


def ensure_html_source_appendix(
    content: str,
    chunks: list[RetrievedChunk],
    citation_labels: list[str] | set[str] | None = None,
) -> str:
    if not chunks:
        return content

    selected = _select_chunks(chunks, citation_labels)
    content = strip_html_sources(content)
    if not selected:
        return content
    appendix = format_html_source_appendix(selected)
    match = BODY_CLOSE_RE.search(content)
    if match:
        return content[: match.start()].rstrip() + "\n" + appendix + "\n" + content[match.start() :]
    return content.rstrip() + "\n" + appendix
