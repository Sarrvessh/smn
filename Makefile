.PHONY: install db-up db-down migrate corpus ingest query dev dev-api dev-web lint test test-e2e evaluate

ROOT := $(CURDIR)
API := $(ROOT)/apps/api
WEB := $(ROOT)/apps/web

install:
	cd $(API) && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]" || .venv/bin/pip install -e ".[dev]"
	cd $(WEB) && npm install

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

migrate:
	cd $(API) && ( .venv/Scripts/alembic upgrade head || .venv/bin/alembic upgrade head )

corpus:
	cd $(API) && ( .venv/Scripts/python -m scripts.corpus || .venv/bin/python -m scripts.corpus )

ingest:
	cd $(API) && ( .venv/Scripts/python -m scripts.ingest_transcripts --incremental || .venv/bin/python -m scripts.ingest_transcripts --incremental )

query:
	cd $(API) && ( .venv/Scripts/python -m scripts.query_transcripts "$(QUERY)" || .venv/bin/python -m scripts.query_transcripts "$(QUERY)" )

dev-api:
	cd $(API) && ( .venv/Scripts/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 || .venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 )

dev-web:
	cd $(WEB) && npm run dev

dev:
	@echo "Run 'make dev-api' and 'make dev-web' in two terminals (or use scripts/dev.ps1)"

lint:
	cd $(API) && ( .venv/Scripts/ruff check app tests || .venv/bin/ruff check app tests )
	cd $(WEB) && npm run lint

test:
	cd $(API) && ( .venv/Scripts/pytest -q || .venv/bin/pytest -q )
	cd $(WEB) && npm run build

test-e2e:
	cd $(WEB) && npm run test:e2e

evaluate:
	cd $(API) && ( .venv/Scripts/python -m scripts.evaluate_rag || .venv/bin/python -m scripts.evaluate_rag )
