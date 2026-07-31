# Architecture — Lenny Growth Assistant

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind, Radix/shadcn, TanStack Query, Zustand |
| Backend | Python 3.12, FastAPI, Pydantic Settings, SQLAlchemy 2 async, Alembic |
| Database | PostgreSQL + pgvector |
| LLMs | Ollama (local) + Anthropic Claude + OpenRouter (optional cloud chat) |
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
  vector + FTS + RRF    Ollama | Anthropic | OpenRouter
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

Deterministic retrieval planner → optional guest/slug/title/catalog-ordinal scope → 1–3 sub-queries (comparisons / follow-ups) → vector top-20 + FTS top-20 per query → reciprocal-rank fusion (k=60) → guest-aware diversity (≤3 chunks/episode, multi-guest for comparisons) → final ~12 citation-labelled evidence passages. Abstain when evidence is empty, scoped episode is missing, vector similarity is weak, or a comparison lacks contrastive guests.

## Security boundaries

- Anthropic / OpenRouter API keys never reach the browser.
- Generated HTML rendered only in `iframe sandbox=""` with restrictive CSP. Visuals use inline SVG + CSS only (no JS, no remote images).
- Markdown sanitized with `rehype-sanitize`.
- Session routes scoped to a single shared workspace user (no per-browser anonymous identity).
- Request size limits on messages and artifacts.

## Deployment

Primary: local Docker Postgres + host Ollama + local API/web.  
Secondary: Supabase + Railway + Vercel (optional).
