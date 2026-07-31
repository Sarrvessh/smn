# Evaluation Report

## Dataset

- File: `evals/questions.json` (23 items)
- Routes: `evals/expected-routes.json`
- Kinds: direct, synthesis, comparison, Ship30, artifact, unsupported
- Includes guest-scoped, comparison, and out-of-range episode-number cases for the retrieval planner

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
- Automated `evaluate_rag` still checks route + “got some chunks” only. Guest scoping, comparison coverage, and true abstention need manual or LLM-judge review after planner changes.
- Episode “number N” resolves to the Nth episode by `publish_date` (not ingest counter). Out-of-range numbers should abstain.

## Latest automated summary

**Route accuracy (offline):** 20/20 = **100%** (re-run after adding g1/c4/u4)

**Smoke knowledge base (hash embeddings, `--limit 5`):**

- Episodes: 5
- Chunks: 224
- Query `product-market fit` returned 8 cited passages with guests, titles, excerpts, and scores

Re-run `make evaluate` after full corpus ingest with a real embedding model and paste JSON below.

