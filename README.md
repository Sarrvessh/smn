# Lenny Growth Assistant

Transcript-grounded product & growth research assistant built on Lenny’s Podcast episodes.

## Features

- Persistent multi-session chat (PostgreSQL)
- Hybrid semantic + keyword retrieval (pgvector + full-text)
- Validated `[S#]` citations with source cards
- Ship30for30 essay skill → Markdown artifact
- Markdown / HTML artifact viewer (sandboxed iframe, no JS)
- Ollama (local) and Anthropic Claude providers

## Prerequisites

- Python 3.11+ (3.12 recommended)
- Node.js 20+
- Docker Desktop
- [Ollama](https://ollama.com) on the host
- Git

```bash
ollama pull qwen3:4b
ollama pull embeddinggemma
```

> **Note:** If `qwen3:4b` is unavailable on your machine, set `OLLAMA_CHAT_MODEL` in `.env` to a local model you already have (e.g. `mistral:7b`). Keep `OLLAMA_EMBED_MODEL=embeddinggemma` (or another embed model) and set `EMBEDDING_DIM` to match.

## Quick start (macOS / Linux / Make)

```bash
git clone <repository>
cd smn   # or lenny-growth-assistant

cp .env.example .env

docker compose up -d postgres

# API
cd apps/api
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix:    source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
python -m scripts.corpus
python -m scripts.ingest_transcripts --incremental
# Optional smoke ingest: python -m scripts.ingest_transcripts --limit 5
cd ../..

# Web
cd apps/web && npm install && cd ../..

# Terminal A
cd apps/api && .venv/Scripts/uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
# Terminal B
cd apps/web && npm run dev
```

Open http://localhost:5173

> If port **8000** fails with `WinError 10013` on Windows, use **8001** (Vite is proxied to `8001` in `apps/web/vite.config.ts`).

### Make targets

```text
make install   make db-up   make migrate
make corpus    make ingest  make query QUERY="product-market fit"
make dev-api   make dev-web
make lint      make test    make test-e2e
make evaluate
```

## Windows PowerShell

```powershell
Copy-Item .env.example .env
docker compose up -d postgres

cd apps\api
python -m venv .venv
.\.venv\Scripts\pip install -e ".[dev]"
.\.venv\Scripts\alembic.exe upgrade head
.\.venv\Scripts\python.exe -m scripts.corpus
.\.venv\Scripts\python.exe -m scripts.ingest_transcripts --incremental

cd ..\web
npm install

# Terminal A
cd ..\api
.\.venv\Scripts\uvicorn.exe app.main:app --reload --host 127.0.0.1 --port 8001

# Terminal B
cd ..\web
npm run dev
```

Or: `. .\scripts\dev.ps1` then `Install-All`, `Db-Up`, `Migrate`, `Corpus`, `Ingest`, `Dev-Api`, `Dev-Web`.

## Corpus

Source: [ChatPRD/lennys-podcast-transcripts](https://github.com/ChatPRD/lennys-podcast-transcripts)  
Cloned to `data/lennys-podcast-transcripts/` (gitignored).

## Docs

| Doc | Path |
|-----|------|
| PRD | [PRD.md](PRD.md) |
| Design | [design.md](design.md) |
| Architecture | [docs/architecture.md](docs/architecture.md) |
| API | [docs/api-contract.md](docs/api-contract.md) |
| Streaming | [docs/streaming-contract.md](docs/streaming-contract.md) |
| Schema | [docs/schema.md](docs/schema.md) |
| Threat model | [docs/threat-model.md](docs/threat-model.md) |
| Evaluation | [docs/evaluation.md](docs/evaluation.md) |
| Agents | [AGENTS.md](AGENTS.md) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Ollama unavailable | Start Ollama; `OLLAMA_BASE_URL=http://localhost:11434` |
| Model missing | `ollama pull qwen3:4b` / `ollama pull embeddinggemma` |
| Empty knowledge base | `python -m scripts.corpus` then ingest |
| Embedding dim mismatch | Set `EMBEDDING_DIM` to the model’s vector size (default 768) |
| Slow/unavailable embed model | Temporary smoke: `OLLAMA_EMBED_MODEL=hash` then re-ingest with `embeddinggemma` or `nomic-embed-text` |
| Docker image pull issues | Compose defaults to `ankane/pgvector:v0.5.1`; alternate `pgvector/pgvector:pg16` if preferred |
| Docker → Ollama | `OLLAMA_BASE_URL=http://host.docker.internal:11434` |
| Anthropic errors | Set `ANTHROPIC_API_KEY` or switch provider to Ollama |

## Demo video

Record a 2–3 minute walkthrough covering: problem → architecture → grounded Q&A with sources → persistence → Ship30 artifact → HTML artifact → provider/trace/tests. Prewarm Ollama before recording. Link the video from the submission form (not required in-repo).

See also [docs/deployment.md](docs/deployment.md).

## License

Educational / evaluation use. Transcript content belongs to Lenny’s Podcast and guests.

