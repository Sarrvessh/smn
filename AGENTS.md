# AGENTS.md — Lenny Growth Assistant

## Role

You are implementing Lenny Growth Assistant per `PRD.md` and locked contracts in `docs/`.

Do not change API, streaming, or schema contracts without updating the docs in the same change.

## Contracts (frozen)

- `docs/api-contract.md`
- `docs/streaming-contract.md`
- `docs/schema.md`
- `docs/architecture.md`

## Skills

| Skill id | Purpose |
|----------|---------|
| `transcript_qa` | Grounded Q&A |
| `ship30_essay` | Ship30for30 essay → markdown artifact |
| `artifact_generator` | Markdown or HTML artifact |

## Corpus

`https://github.com/ChatPRD/lennys-podcast-transcripts` → `data/lennys-podcast-transcripts/`

## Branch ownership

```text
main
├── feat/backend-foundation   → apps/api/app/core, db, llm, alembic, docker-compose
├── feat/retrieval-agent      → ingestion, retrieval, agents, skills, evals
├── feat/frontend-workspace   → apps/web
└── feat/docs-evals           → README, PRD, design, docs
```

Do not concurrently edit: `docker-compose.yml`, `.env.example`, migrations, API schemas, streaming contract, root lockfiles, root README, CI.

## Task format

Every task must include: Existing Contract, Files You May Modify, Required Behavior, Non-Goals, Acceptance Criteria, Validation Commands, Final Report.

## Prioritization

When time is tight: Ollama local → ingest → grounded Q&A → sessions → citations → Ship30 → MD artifacts → HTML artifacts → provider switch → errors → docs → tests → polish → hosted deploy.
