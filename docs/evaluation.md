# Evaluation Report

## Dataset

- File: `evals/questions.json` (20 items)
- Routes: `evals/expected-routes.json`
- Kinds: direct (5), synthesis (5), comparison (3), Ship30 (2), artifact (2), unsupported (3)

## How to run

```bash
cd apps/api
.venv/Scripts/python -m scripts.evaluate_rag   # Windows
# or: .venv/bin/python -m scripts.evaluate_rag
```

Requires Postgres with ingested chunks for retrieval hit-rate. Route accuracy runs without LLM.

## Metrics (targets)

| Metric | Target |
|--------|--------|
| Route accuracy | ≥ 90% on expected-routes |
| Retrieval hit rate (supported Qs) | ≥ 70% after full ingest |
| Citation validity | Invalid labels stripped 100% |
| Abstention on unsupported | Prefer abstain / weak evidence |
| Essay format | Headings + bullets present (soft warn on word count) |

## Notes

- Do not claim zero hallucinations.
- Local chat model quality varies; Anthropic improves long-form Ship30/artifacts.
- For smoke ingest without an Ollama embed model, set `OLLAMA_EMBED_MODEL=hash` (deterministic vectors). Prefer `embeddinggemma` or `nomic-embed-text` for production-quality retrieval.

## Latest automated summary

**Route accuracy (offline):** 20/20 = **100%**

**Smoke knowledge base (hash embeddings, `--limit 5`):**

- Episodes: 5
- Chunks: 224
- Query `product-market fit` returned 8 cited passages with guests, titles, excerpts, and scores

Re-run `make evaluate` after full corpus ingest with a real embedding model and paste JSON below.
