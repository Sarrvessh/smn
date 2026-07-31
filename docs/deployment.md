## Deployment (optional)

Local evaluation is primary. Optional hosted stack:

- Database: Supabase PostgreSQL with pgvector
- API: Railway (`apps/api`)
- Web: Vercel or Railway (`apps/web`)

Set `DATABASE_URL`, `CORS_ORIGINS`, provider keys (`ANTHROPIC_API_KEY` and/or `OPENROUTER_API_KEY`), and `OLLAMA_BASE_URL` appropriately. Hosted failure must not block local demo.

**Provider expectation for assessment:** local demo via Ollama; production path works when an Anthropic key is supplied via env. OpenRouter is a valid alternate cloud chat provider for development and testing; embeddings remain local (Ollama).

## Demo video

Record a 2–3 minute walkthrough covering: problem → architecture → grounded Q&A with sources → persistence → Ship30 artifact → HTML artifact → provider/trace/tests. Prewarm Ollama before recording. Link the video from the submission form (not required in-repo).
