# Streaming Contract

## Transport

- Method: `POST /api/v1/sessions/{session_id}/messages/stream`
- Content-Type request: `application/json`
- Content-Type response: `application/x-ndjson`
- Each line is one JSON object with an `event` field.

Frontend uses `fetch()` + `ReadableStream` + `AbortController` for Stop.

## Events

### `run_started`

```json
{ "event": "run_started", "run_id": "uuid", "message_id": "uuid" }
```

### `status`

```json
{ "event": "status", "stage": "retrieving", "label": "Searching Lenny's transcripts" }
```

Stages: `routing` | `retrieving` | `generating` | `validating` | `saving`

### `sources`

```json
{
  "event": "sources",
  "sources": [
    {
      "id": "S1",
      "guest": "...",
      "episode": "...",
      "excerpt": "...",
      "url": "...",
      "publish_date": null
    }
  ]
}
```

### `token`

```json
{ "event": "token", "text": "Product-market fit..." }
```

### `content_replace`

Sent when the server polishes the streamed answer (Markdown normalization / citation cleanup). Clients should replace the assistant message body with `text`.

```json
{ "event": "content_replace", "text": "### Direct answer\n\n..." }
```

### `artifact`

```json
{
  "event": "artifact",
  "artifact_id": "uuid",
  "type": "markdown",
  "title": "..."
}
```

### `completed`

```json
{
  "event": "completed",
  "message_id": "uuid",
  "skill": "transcript_qa",
  "latency_ms": 4210
}
```

### `error`

```json
{
  "event": "error",
  "code": "OLLAMA_UNAVAILABLE",
  "message": "Ollama could not be reached.",
  "retryable": true
}
```

## Cancellation

1. Client aborts the fetch.
2. Backend cancels generation where possible.
3. Message status → `cancelled`.
4. Partial text may be kept with an incomplete label.
5. Retry reuses the same user message (no duplicate).
