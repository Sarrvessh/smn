import pytest

from app.agents.formatting import normalize_qa_markdown
from app.agents.schemas import route_skill
from app.core.security import sanitize_html_artifact, validate_artifact_content
from app.db.models import ChatSession
from app.ingestion.chunker import chunk_transcript, count_tokens
from app.ingestion.parser import normalize_content
from app.retrieval.citations import validate_citations


def test_normalize_content_collapses_blank_lines():
    text = "a\n\n\n\nb\r\nc"
    out = normalize_content(text)
    assert "\r" not in out
    assert "\n\n\n\n" not in out


def test_chunker_respects_max_and_produces_chunks():
    paras = [f"Sentence number {i}. " * 20 for i in range(30)]
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
    raw = "### Direct Answer Onboarding advice across guests: - **Proxy Metrics**: Adam [S1]"
    out = normalize_qa_markdown(raw)
    assert out.startswith("### Direct answer\n")
    assert "Onboarding advice" in out
    assert "\n- **Proxy Metrics**" in out


def test_citation_validation_strips_invalid():
    text, valid, invalid = validate_citations("Claim [S1] and fake [S9]", {"S1"})
    assert "S1" in valid
    assert "S9" in invalid
    assert "[S9]" not in text
    assert "[S1]" in text


def test_html_sanitize_blocks_script():
    with pytest.raises(ValueError):
        sanitize_html_artifact("<html><body><script>alert(1)</script></body></html>")


def test_html_sanitize_allows_inline_svg_chart():
    html = validate_artifact_content(
        "html",
        """<!DOCTYPE html><html><head><title>Scorecard</title></head><body>
        <h1>Retention Scorecard</h1>
        <svg viewBox="0 0 120 80" role="img" aria-label="Bar chart">
          <title>Bar chart</title>
          <rect x="10" y="20" width="20" height="50" fill="#4F5FE8"/>
          <rect x="40" y="35" width="20" height="35" fill="#4F5FE8"/>
        </svg>
        <div class="chart"><div class="track"><i style="width:70%"></i></div></div>
        </body></html>""",
        100000,
    )
    assert "<svg" in html
    assert "Content-Security-Policy" in html
    assert "script-src 'none'" in html


def test_html_sanitize_blocks_remote_image_and_foreign_object():
    with pytest.raises(ValueError):
        sanitize_html_artifact('<html><body><img src="https://evil.example/x.png" /></body></html>')
    with pytest.raises(ValueError):
        sanitize_html_artifact(
            '<html><body><svg><foreignObject width="100" height="100">'
            "<div>x</div></foreignObject></svg></body></html>"
        )


def test_html_artifact_gets_csp():
    html = validate_artifact_content(
        "html",
        "<html><head></head><body><h1>Hi</h1></body></html>",
        100000,
    )
    assert "Content-Security-Policy" in html
    assert "script-src 'none'" in html


def test_html_artifact_enforces_csp_even_when_document_supplies_one():
    html = sanitize_html_artifact(
        '<HTML><HEAD data-test="x">'
        '<meta http-equiv="Content-Security-Policy" content="default-src *">'
        "</HEAD><BODY><h1>Safe</h1></BODY></HTML>"
    )
    assert html.count("Content-Security-Policy") == 2
    assert "object-src 'none'" in html
    assert "base-uri 'none'" in html
    assert html.index("default-src 'none'") < html.index("default-src *")


def test_session_settings_do_not_have_automatic_updated_at_mutation():
    assert ChatSession.__table__.c.updated_at.onupdate is None
