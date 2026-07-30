from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field


class RouteDecision(BaseModel):
    skill: Literal["transcript_qa", "ship30_essay", "artifact_generator"]
    artifact_type: Literal["markdown", "html"] | None = None
    confidence: float = 1.0
    reason: str = ""
    routing_method: str = "explicit"


SHIP30_RE = re.compile(
    r"\b(ship30|ship\s*30|long[- ]form essay|write an essay|turn .+ into .+ essay)\b",
    re.IGNORECASE,
)
ARTIFACT_RE = re.compile(
    r"\b(html|markdown|artifact|dashboard|checklist|landing page|strategy canvas|playbook)\b",
    re.IGNORECASE,
)
HTML_RE = re.compile(r"\b(html|css|dashboard|landing page)\b", re.IGNORECASE)


def route_skill(message: str, mode: str = "auto") -> RouteDecision:
    mode = (mode or "auto").lower()
    if mode in {"transcript_qa", "ask", "ask_lenny"}:
        return RouteDecision(
            skill="transcript_qa",
            confidence=1.0,
            reason="explicit mode",
            routing_method="explicit",
        )
    if mode in {"ship30_essay", "ship30"}:
        return RouteDecision(
            skill="ship30_essay",
            confidence=1.0,
            reason="explicit mode",
            routing_method="explicit",
        )
    if mode in {"artifact", "artifact_generator"}:
        artifact_type: Literal["markdown", "html"] = "html" if HTML_RE.search(message) else "markdown"
        return RouteDecision(
            skill="artifact_generator",
            artifact_type=artifact_type,
            confidence=1.0,
            reason="explicit mode",
            routing_method="explicit",
        )

    # Deterministic auto routing
    if SHIP30_RE.search(message):
        return RouteDecision(
            skill="ship30_essay",
            confidence=0.9,
            reason="matched ship30/essay intent",
            routing_method="deterministic",
        )
    if ARTIFACT_RE.search(message):
        artifact_type = "html" if HTML_RE.search(message) else "markdown"
        return RouteDecision(
            skill="artifact_generator",
            artifact_type=artifact_type,
            confidence=0.85,
            reason="matched artifact intent",
            routing_method="deterministic",
        )
    return RouteDecision(
        skill="transcript_qa",
        confidence=0.8,
        reason="default transcript Q&A",
        routing_method="deterministic",
    )


class QAResult(BaseModel):
    answer_markdown: str
    source_ids: list[str] = Field(default_factory=list)
    confidence: float = 0.5


class Ship30Result(BaseModel):
    title: str
    markdown: str
    source_ids: list[str] = Field(default_factory=list)
    estimated_word_count: int = 0


class ArtifactResult(BaseModel):
    title: str
    artifact_type: Literal["markdown", "html"]
    language: Literal["markdown", "html"]
    content: str
    source_ids: list[str] = Field(default_factory=list)
    summary: str = ""
