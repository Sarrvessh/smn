# Day-2 hard gate results

Run: `python -m scripts.hard_gate` (via `apps/api/scripts/hard_gate.py`) against `http://127.0.0.1:8001`.

## Latest run (2026-07-30)

- live/ready: PASS
- chat models exclude embeddings: PASS
- grounded transcript Q&A stream + sources: PASS
- session persistence + isolation: PASS
- Ship30 markdown artifact: PASS
- HTML artifact (no script): PASS
- Playwright e2e (smoke + hard-gate UI): 4/4 PASS

## Notes

- LLM timeout raised to 300s (`LLM_REQUEST_TIMEOUT_SECONDS`) for local Ollama.
- Pause full corpus ingest while re-running the API hard gate to avoid Ollama contention.
