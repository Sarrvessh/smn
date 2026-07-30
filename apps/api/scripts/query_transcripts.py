"""CLI hybrid retrieval over ingested transcripts."""

from __future__ import annotations

import asyncio
import sys

from app.db.session import AsyncSessionLocal
from app.retrieval.hybrid_search import hybrid_retrieve, to_source_payload


async def _query(q: str) -> None:
    async with AsyncSessionLocal() as session:
        chunks = await hybrid_retrieve(session, q)
        sources = to_source_payload(chunks)
        if not sources:
            print("No results.")
            return
        for s in sources:
            print("=" * 60)
            print(f"[{s['id']}] score={s['score']:.4f}")
            print(f"Guest: {s['guest']}")
            print(f"Episode: {s['episode']}")
            print(f"Source: {s['url']}")
            print(f"Excerpt:\n{s['excerpt']}")


def main() -> int:
    q = " ".join(sys.argv[1:]).strip() or "product-market fit"
    asyncio.run(_query(q))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
