from app.ingestion.chunker import chunk_transcript, count_tokens
from app.ingestion.parser import normalize_content
from app.agents.schemas import route_skill
from app.retrieval.citations import validate_citations
from app.core.security import sanitize_html_artifact, validate_artifact_content
import pytest


def test_normalize_content_collapses_blank_lines():
    text = "a\n\n\n\nb\r\nc"
    out = normalize_content(text)
    assert "\r" not in out
    assert "\n\n\n\n" not in out


def test_chunker_respects_max_and_produces_chunks():
    paras = ["Sentence number %d. " % i * 20 for i in range(30)]
    text = "\n\n".join(paras)
    chunks = chunk_transcript(text, target_tokens=200, max_tokens=300, overlap_tokens=40)
    assert len(chunks) >= 2
    assert all(count_tokens(c) <= 400 for c in chunks)


def test_route_ship30_deterministic():
    d = route_skill("Turn this into a Ship30 essay for founders", "auto")
    assert d.skill == "ship30_essay"
    assert d.routing_method == "deterministic"


def test_route_artifact_html():
    d = route_skill("Create an HTML growth dashboard", "auto")
    assert d.skill == "artifact_generator"
    assert d.artifact_type == "html"


def test_route_explicit_wins():
    d = route_skill("write an essay please", "transcript_qa")
    assert d.skill == "transcript_qa"
    assert d.routing_method == "explicit"


def test_normalize_qa_markdown_splits_glued_heading():
    from app.agents.formatting import normalize_qa_markdown

    raw = (
        "### Direct Answer Onboarding advice across guests: "
        "- **Proxy Metrics**: Adam [S1]"
    )
    out = normalize_qa_markdown(raw)
    assert out.startswith("### Direct answer\n")
    assert "Onboarding advice" in out
    assert "\n- **Proxy Metrics**" in out


def test_html_sanitize_blocks_script():
    with pytest.raises(ValueError):
        sanitize_html_artifact('<html><body><script>alert(1)</script></body></html>')


def test_html_artifact_gets_csp():
    html = validate_artifact_content(
        "html",
        "<html><head></head><body><h1>Hi</h1></body></html>",
        100000,
    )
    assert "Content-Security-Policy" in html
    assert "script-src 'none'" in html
