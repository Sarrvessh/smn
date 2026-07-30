from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class AppError(Exception):
    code: str
    message: str
    retryable: bool = False
    status_code: int = 400
    details: dict[str, Any] | None = None

    def to_dict(self, request_id: str) -> dict[str, Any]:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "retryable": self.retryable,
                "request_id": request_id,
            }
        }


OLLAMA_UNAVAILABLE = "OLLAMA_UNAVAILABLE"
OLLAMA_MODEL_MISSING = "OLLAMA_MODEL_MISSING"
PROVIDER_NOT_CONFIGURED = "PROVIDER_NOT_CONFIGURED"
PROVIDER_TIMEOUT = "PROVIDER_TIMEOUT"
DATABASE_UNAVAILABLE = "DATABASE_UNAVAILABLE"
KNOWLEDGE_BASE_EMPTY = "KNOWLEDGE_BASE_EMPTY"
EMBEDDING_DIMENSION_MISMATCH = "EMBEDDING_DIMENSION_MISMATCH"
INVALID_SESSION = "INVALID_SESSION"
ARTIFACT_VALIDATION_FAILED = "ARTIFACT_VALIDATION_FAILED"
STREAM_INTERRUPTED = "STREAM_INTERRUPTED"
