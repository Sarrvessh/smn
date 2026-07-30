## Deployment (optional)

Local evaluation is primary. Optional hosted stack:

- Database: Supabase PostgreSQL with pgvector
- API: Railway (`apps/api`)
- Web: Vercel or Railway (`apps/web`)

Set `DATABASE_URL`, `CORS_ORIGINS`, provider keys, and `OLLAMA_BASE_URL` appropriately. Hosted failure must not block local demo.

## Demo video

Record a 2–3 minute walkthrough covering: problem → architecture → grounded Q&A with sources → persistence → Ship30 artifact → HTML artifact → provider/trace/tests. Prewarm Ollama before recording. Link the video from the submission form (not required in-repo).
