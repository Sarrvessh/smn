# Architecture — Lenny Growth Assistant

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind, Radix/shadcn, TanStack Query, Zustand |
| Backend | Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy 2 async, Alembic |
| Database | PostgreSQL + pgvector |
| LLMs | Ollama (local) + Anthropic Claude |
| Embeddings | Ollama `embeddinggemma` (separate from chat provider) |

## Component diagram

```text
React Frontend
  Session Sidebar | Conversation | Sources | Artifact Viewer
        │ HTTP + NDJSON stream
FastAPI /api/v1
  Sessions | Messages | Providers | Artifacts | Health
        │
Conversation Service → Skill Router
  transcript_qa | ship30_essay | artifact_generator
        │                    │
Retrieval Service      Provider Registry
  vector + FTS + RRF    Ollama | Anthropic
        │
PostgreSQL + pgvector
  users, sessions, messages, episodes, chunks, sources, artifacts, agent_runs
```

## Skill routing

1. Explicit composer mode wins.
2. Deterministic keyword/intent rules.
3. Structured model routing when ambiguous.
4. Fallback: `transcript_qa`.

## Retrieval

Query embed → vector top-20 + FTS top-20 → reciprocal-rank fusion (k=60) → ≤3 chunks/episode → final 6–8 → citation-labelled evidence.

## Security boundaries

- Anthropic keys never reach the browser.
- Generated HTML rendered only in `iframe sandbox=""` with restrictive CSP.
- Markdown sanitized with `rehype-sanitize`.
- Session routes scoped to a single shared workspace user (no per-browser anonymous identity).
- Request size limits on messages and artifacts.

## Deployment

Primary: local Docker Postgres + host Ollama + local API/web.  
Secondary: Supabase + Railway + Vercel (optional).
