from uuid import uuid4

from app.retrieval.hybrid_search import (
    EpisodeRef,
    RetrievedChunk,
    apply_diversity,
    extract_episode_number,
    format_evidence,
    match_guests_in_text,
    plan_retrieval,
    reciprocal_rank_fusion,
    should_abstain,
    to_source_payload,
)


def _chunk(**kwargs) -> RetrievedChunk:
    defaults = {
        "chunk_id": uuid4(),
        "episode_id": uuid4(),
        "content": "x",
        "guest": "Guest",
        "episode_title": "Episode",
        "source_url": None,
        "publish_date": None,
    }
    defaults.update(kwargs)
    return RetrievedChunk(**defaults)


def test_rrf_combines_ranks():
    a = uuid4()
    b = uuid4()
    v1 = _chunk(chunk_id=a, vector_rank=1, vector_score=0.9)
    v2 = _chunk(chunk_id=b, vector_rank=2, vector_score=0.8)
    k1 = _chunk(
        chunk_id=b,
        episode_id=v2.episode_id,
        keyword_rank=1,
        keyword_score=0.7,
    )
    fused = reciprocal_rank_fusion([v1, v2], [k1], k=60)
    assert len(fused) == 2
    assert fused[0].chunk_id == b


def test_diversity_caps_per_episode():
    ep = uuid4()
    chunks = [
        _chunk(episode_id=ep, content=f"c{i}", combined_score=10 - i) for i in range(5)
    ]
    other = _chunk(guest="g2", episode_title="e2", combined_score=9.5)
    selected = apply_diversity(chunks + [other], max_per_episode=2, final_n=4)
    from_ep = [c for c in selected if c.episode_id == ep]
    assert len(from_ep) <= 2
    assert len(selected) <= 4


def test_guest_diversity_prefers_multiple_guests():
    ep1, ep2, ep3 = uuid4(), uuid4(), uuid4()
    chunks = [
        _chunk(episode_id=ep1, guest="Ada", combined_score=10),
        _chunk(episode_id=ep1, guest="Ada", combined_score=9.5),
        _chunk(episode_id=ep2, guest="Ben", combined_score=9),
        _chunk(episode_id=ep3, guest="Cara", combined_score=8),
    ]
    selected = apply_diversity(
        chunks, max_per_episode=2, final_n=3, prefer_multi_guest=True
    )
    guests = {c.guest for c in selected}
    assert "Ada" in guests
    assert "Ben" in guests
    assert len(guests) >= 2


def test_abstain_when_empty_or_weak():
    assert should_abstain([]) is True
    weak = _chunk(vector_score=0.1, vector_rank=1)
    assert should_abstain([weak]) is True


def test_abstain_ignores_keyword_only_hits():
    # Keyword match without strong vector similarity must still abstain
    keyword_only = _chunk(keyword_rank=1, keyword_score=0.9, vector_score=0.05)
    assert should_abstain([keyword_only]) is True
    strong = _chunk(vector_score=0.4, vector_rank=1, keyword_rank=1)
    assert should_abstain([strong]) is False


def test_abstain_comparison_needs_two_guests():
    a = _chunk(guest="Ada", vector_score=0.5)
    b = _chunk(guest="Ada", vector_score=0.45, episode_id=uuid4())
    assert should_abstain([a, b], intent="comparison") is True
    c = _chunk(guest="Ben", vector_score=0.42)
    assert should_abstain([a, c], intent="comparison") is False


def test_abstain_scoped_missing():
    strong = _chunk(vector_score=0.9)
    assert should_abstain([strong], scoped_missing=True) is True


def test_format_evidence_labels():
    c = _chunk(
        content="passage",
        guest="Brian Chesky",
        episode_title="Airbnb",
        source_url="https://youtube.com/x",
        publish_date="2020-01-01",
        combined_score=1.0,
    )
    text = format_evidence([c])
    assert "[S1]" in text
    assert c.citation_label == "S1"
    payload = to_source_payload([c])
    assert payload[0]["id"] == "S1"
    assert "Brian" in payload[0]["guest"]


def test_extract_episode_number():
    assert extract_episode_number("Create a dashboard of podcast number 234") == 234
    assert extract_episode_number("episode #12 summary") == 12
    assert extract_episode_number("What is PMF?") is None


def test_match_guests_in_text():
    catalog = [
        EpisodeRef(id=uuid4(), guest="Nir Eyal", title="Indistractable", slug="nir-eyal"),
        EpisodeRef(id=uuid4(), guest="Brian Chesky", title="Airbnb", slug="brian-chesky"),
    ]
    hits = match_guests_in_text("What did Nir Eyal say about habits?", catalog)
    assert len(hits) == 1
    assert hits[0].guest == "Nir Eyal"


def test_plan_retrieval_comparison():
    catalog = [
        EpisodeRef(id=uuid4(), guest="Ada", title="A", slug="ada"),
        EpisodeRef(id=uuid4(), guest="Ben", title="B", slug="ben"),
    ]
    resolved = catalog
    plan = plan_retrieval(
        "Compare Ada and Ben on onboarding",
        catalog,
        resolved=resolved,
    )
    assert plan.intent == "comparison"
    assert len(plan.queries) >= 2
    assert plan.episode_ids is not None
    assert len(plan.episode_ids) == 2


def test_plan_retrieval_scoped_missing():
    catalog = [
        EpisodeRef(id=uuid4(), guest="Ada", title="A", slug="ada"),
    ]
    plan = plan_retrieval(
        "podcast number 999",
        catalog,
        scoped_missing=True,
    )
    assert plan.intent == "scoped_episode"
    assert plan.scoped_missing is True
    assert plan.episode_ids == []


def test_plan_retrieval_followup_uses_history_guests():
    catalog = [
        EpisodeRef(id=uuid4(), guest="Nir Eyal", title="Indistractable", slug="nir-eyal"),
    ]
    plan = plan_retrieval(
        "What else did they say?",
        catalog,
        history_texts=["Earlier we discussed Nir Eyal on habits."],
    )
    assert plan.intent in {"followup", "scoped_episode"}
    assert "Nir Eyal" in plan.guests or any("Nir" in q for q in plan.queries)
