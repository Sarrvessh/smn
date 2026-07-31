# Acceptance Checklist Status

Generated during implementation.

## Product

- [x] New Chat / sessions API + UI
- [x] Sessions persist in PostgreSQL
- [x] Owner-scoped session access
- [x] Ollama + Anthropic + OpenRouter providers
- [x] Provider/model per session
- [x] Transcript ingest (ChatPRD corpus)
- [x] Hybrid retrieval + query CLI
- [x] Citation validation
- [x] Ship30 + artifact skills
- [x] Markdown/HTML artifact viewer (sandboxed)
- [x] Provider error recovery copy in API/errors

## Engineering

- [x] Alembic clean migration
- [x] Idempotent ingest (source_hash)
- [x] Embedding dim validation
- [x] Structured routing + fallback
- [x] Streaming NDJSON contract
- [x] Live token stream for transcript Q&A (not fake post-hoc chunks)
- [x] Backend pytest (12+)
- [x] Frontend production build
- [x] Playwright smoke + Day-2 hard-gate UI specs
- [x] Day-2 API hard gate: Q&A + persistence/isolation + Ship30 + HTML
- [x] Agent transcripts scaffolded with samples
- [ ] Full corpus ingest (303 episodes) — running incrementally in background

## Documentation

- [x] README, PRD, design, architecture, schema, API, streaming
- [x] Threat model, evaluation, deployment notes
- [ ] Demo video (record at submission time)
- [ ] Public GitHub repo / submission form (operator step)
