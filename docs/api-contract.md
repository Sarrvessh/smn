# API Contract — `/api/v1`

Base URL: `http://localhost:8000/api/v1`

All error responses:

```json
{
  "error": {
    "code": "PROVIDER_NOT_CONFIGURED",
    "message": "Anthropic is not configured.",
    "retryable": false,
    "request_id": "uuid"
  }
}
```

## Shared workspace (no per-browser user)

The API uses a single shared workspace identity for all clients. Sessions are visible to everyone using the local deployment.

`X-User-Id` is **not required**.

### `POST /users/anonymous`

Deprecated compatibility endpoint. Returns the shared workspace user id.

Response `201`:

```json
{ "id": "00000000-0000-4000-8000-000000000001", "created_at": "ISO-8601" }
```

## Sessions

### `POST /sessions`

```json
{ "title": "New chat", "provider": "ollama", "model": "qwen3:4b" }
```

### `GET /sessions`

Returns non-archived sessions for the user, newest first.

### `GET /sessions/{session_id}`

### `PATCH /sessions/{session_id}`

```json
{ "title": "...", "provider": "ollama", "model": "...", "archived": false }
```

### `DELETE /sessions/{session_id}`

Soft-archives the session (`archived_at` set).

## Messages

### `GET /sessions/{session_id}/messages`

Returns messages with embedded sources when present. Assistant turns that produced an artifact include `artifact_id` so the client can reopen them later.

```json
{
  "id": "uuid",
  "role": "assistant",
  "content": "...",
  "status": "completed",
  "skill": "ship30_essay",
  "provider": "ollama",
  "model": "qwen2.5:7b",
  "latency_ms": 1200,
  "error_code": null,
  "created_at": "ISO-8601",
  "sources": [],
  "artifact_id": "uuid"
}
```

`artifact_id` is `null` when the message has no linked artifact.

### `POST /sessions/{session_id}/messages/stream`

Request:

```json
{
  "content": "What do Lenny's guests say about product-market fit?",
  "mode": "auto",
  "provider": "ollama",
  "model": "qwen3:4b"
}
```

`mode`: `auto` | `transcript_qa` | `ship30_essay` | `artifact`

Response: `Content-Type: application/x-ndjson` — see [streaming-contract.md](streaming-contract.md).

## Artifacts

### `GET /artifacts/{artifact_id}`

```json
{
  "id": "uuid",
  "session_id": "uuid",
  "message_id": "uuid",
  "type": "markdown",
  "title": "...",
  "content": "...",
  "language": "markdown",
  "created_at": "ISO-8601"
}
```

## Providers

### `GET /providers`

### `GET /providers/health`

```json
{
  "providers": [
    {
      "id": "ollama",
      "configured": true,
      "healthy": true,
      "models": ["qwen3:4b"]
    },
    {
      "id": "anthropic",
      "configured": false,
      "healthy": false,
      "models": []
    }
  ]
}
```

## Health & knowledge

### `GET /health/live`

### `GET /health/ready`

### `GET /knowledge/status`

```json
{
  "episodes": 0,
  "chunks": 0,
  "ready": false,
  "embedding_dim": null
}
```

## Error codes

`OLLAMA_UNAVAILABLE`, `OLLAMA_MODEL_MISSING`, `PROVIDER_NOT_CONFIGURED`, `PROVIDER_TIMEOUT`, `DATABASE_UNAVAILABLE`, `KNOWLEDGE_BASE_EMPTY`, `EMBEDDING_DIMENSION_MISMATCH`, `INVALID_SESSION`, `ARTIFACT_VALIDATION_FAILED`, `STREAM_INTERRUPTED`
