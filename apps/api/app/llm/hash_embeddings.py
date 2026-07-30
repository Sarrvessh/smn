from __future__ import annotations

import hashlib
import math
import struct

from app.core.config import get_settings


class HashEmbeddingProvider:
    """Deterministic offline embeddings for smoke ingest when Ollama models are unavailable."""

    def __init__(self, dim: int | None = None) -> None:
        self.dim = dim or get_settings().embedding_dim

    def _embed_one(self, text: str) -> list[float]:
        seed = hashlib.sha256(text.encode("utf-8")).digest()
        values: list[float] = []
        counter = 0
        while len(values) < self.dim:
            block = hashlib.sha256(seed + counter.to_bytes(4, "little")).digest()
            for i in range(0, len(block), 4):
                if len(values) >= self.dim:
                    break
                (n,) = struct.unpack_from("<I", block, i)
                values.append((n / 0xFFFFFFFF) * 2.0 - 1.0)
            counter += 1
        # L2 normalize for cosine similarity stability
        norm = math.sqrt(sum(v * v for v in values)) or 1.0
        return [v / norm for v in values]

    async def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._embed_one(t) for t in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._embed_one(text)
