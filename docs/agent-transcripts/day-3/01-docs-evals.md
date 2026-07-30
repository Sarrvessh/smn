# Goal

Docs, evals, CI, threat model, acceptance packaging.

# Agent and model

Cursor agent

# Original prompt

Finish Phase 5 submission deliverables.

# Files changed

- README.md, docs/threat-model.md, docs/evaluation.md
- .github/workflows/ci.yml
- evals/*, apps/api/tests/test_retrieval.py

# Commands executed

- pytest, npm run build, docker compose (as available)

# Result

Submission docs and CI present.

# What failed

Full corpus embedding ingest may be slow on first run without GPU.

# Why it failed

Local embedding throughput limits.

# Human correction

Document `--limit` for smoke ingest; full ingest via `make ingest`.

# Final status

Phase 5 checklist items authored.

# Related commit

n/a
