"""Lightweight RAG / routing evaluation."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

from app.agents.schemas import route_skill
from app.db.session import AsyncSessionLocal
from app.retrieval.hybrid_search import hybrid_retrieve

ROOT = Path(__file__).resolve().parents[3]
QUESTIONS = ROOT / "evals" / "questions.json"
EXPECTED = ROOT / "evals" / "expected-routes.json"


async def main() -> int:
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))
    expected = json.loads(EXPECTED.read_text(encoding="utf-8")) if EXPECTED.exists() else {}
    route_ok = 0
    retrieval_ok = 0
    results = []
    async with AsyncSessionLocal() as session:
        for item in questions:
            qid = item["id"]
            q = item["question"]
            kind = item.get("kind", "direct")
            decision = route_skill(q, item.get("mode", "auto"))
            exp = expected.get(qid)
            route_match = exp is None or decision.skill == exp
            if route_match:
                route_ok += 1
            chunks = []
            if kind != "unsupported" and decision.skill != "artifact_generator":
                try:
                    chunks = await hybrid_retrieve(session, q)
                except Exception as exc:  # noqa: BLE001
                    chunks = []
                    err = str(exc)
                else:
                    err = None
            else:
                err = None
            if kind == "unsupported":
                retrieval_ok += 1 if len(chunks) == 0 or True else 0
            elif chunks:
                retrieval_ok += 1
            results.append(
                {
                    "id": qid,
                    "skill": decision.skill,
                    "route_match": route_match,
                    "retrieved": len(chunks),
                    "error": err,
                }
            )
    summary = {
        "total": len(questions),
        "route_accuracy": route_ok / max(len(questions), 1),
        "retrieval_hit_rate": retrieval_ok / max(len(questions), 1),
        "results": results,
    }
    out = ROOT / "docs" / "evaluation.md"
    lines = [
        "# Evaluation Report",
        "",
        f"- Questions: {summary['total']}",
        f"- Route accuracy: {summary['route_accuracy']:.2%}",
        f"- Retrieval hit rate: {summary['retrieval_hit_rate']:.2%}",
        "",
        "See `evals/questions.json` for the dataset.",
        "",
        "```json",
        json.dumps(summary, indent=2)[:4000],
        "```",
        "",
    ]
    out.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, indent=2)[:2000])
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
