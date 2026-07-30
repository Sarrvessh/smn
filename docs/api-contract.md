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

## Anonymous user

### `POST /users/anonymous`

Creates an anonymous user. Client stores `id` in localStorage.

Response `201`:

```json
{ "id": "uuid", "created_at": "ISO-8601" }
```

Header for authenticated routes: `X-User-Id: <uuid>`

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

Returns messages with embedded sources when present.

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
