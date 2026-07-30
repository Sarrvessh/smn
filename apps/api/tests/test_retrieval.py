from uuid import uuid4

from app.retrieval.hybrid_search import (
    RetrievedChunk,
    apply_diversity,
    reciprocal_rank_fusion,
    should_abstain,
    format_evidence,
    to_source_payload,
)


def _chunk(ep: int, idx: int, vector_rank=None, keyword_rank=None, vscore=None) -> RetrievedChunk:
    eid = uuid4()
    # stable episode id per ep number via namespace-ish approach
    return RetrievedChunk(
        chunk_id=uuid4(),
        episode_id=uuid4() if ep < 0 else uuid4(),
        content=f"content-{ep}-{idx}",
        guest=f"Guest{ep}",
        episode_title=f"Episode{ep}",
        source_url="https://example.com",
        publish_date=None,
        vector_rank=vector_rank,
        vector_score=vscore,
        keyword_rank=keyword_rank,
        keyword_score=0.5 if keyword_rank else None,
    )


def test_rrf_combines_ranks():
    a = uuid4()
    b = uuid4()
    v1 = RetrievedChunk(
        chunk_id=a,
        episode_id=uuid4(),
        content="a",
        guest="g",
        episode_title="e",
        source_url=None,
        publish_date=None,
        vector_rank=1,
        vector_score=0.9,
    )
    v2 = RetrievedChunk(
        chunk_id=b,
        episode_id=uuid4(),
        content="b",
        guest="g",
        episode_title="e",
        source_url=None,
        publish_date=None,
        vector_rank=2,
        vector_score=0.8,
    )
    k1 = RetrievedChunk(
        chunk_id=b,
        episode_id=v2.episode_id,
        content="b",
        guest="g",
        episode_title="e",
        source_url=None,
        publish_date=None,
        keyword_rank=1,
        keyword_score=0.7,
    )
    fused = reciprocal_rank_fusion([v1, v2], [k1], k=60)
    assert len(fused) == 2
    # b appears in both lists → higher combined score
    assert fused[0].chunk_id == b


def test_diversity_caps_per_episode():
    ep = uuid4()
    chunks = [
        RetrievedChunk(
            chunk_id=uuid4(),
            episode_id=ep,
            content=f"c{i}",
            guest="g",
            episode_title="e",
            source_url=None,
            publish_date=None,
            combined_score=10 - i,
        )
        for i in range(5)
    ]
    other = RetrievedChunk(
        chunk_id=uuid4(),
        episode_id=uuid4(),
        content="other",
        guest="g2",
        episode_title="e2",
        source_url=None,
        publish_date=None,
        combined_score=9.5,
    )
    selected = apply_diversity(chunks + [other], max_per_episode=2, final_n=4)
    from_ep = [c for c in selected if c.episode_id == ep]
    assert len(from_ep) <= 2
    assert len(selected) <= 4


def test_abstain_when_empty_or_weak():
    assert should_abstain([]) is True
    weak = RetrievedChunk(
        chunk_id=uuid4(),
        episode_id=uuid4(),
        content="x",
        guest="g",
        episode_title="e",
        source_url=None,
        publish_date=None,
        vector_score=0.1,
        vector_rank=1,
    )
    assert should_abstain([weak]) is True


def test_format_evidence_labels():
    c = RetrievedChunk(
        chunk_id=uuid4(),
        episode_id=uuid4(),
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
