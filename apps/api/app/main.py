from __future__ import annotations

from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.routes import router as v1_router
from app.api.v1.stream import router as stream_router
from app.core.config import get_settings
from app.core.errors import AppError
from app.core.logging import setup_logging
from app.db.session import engine

setup_logging()
settings = get_settings()

app = FastAPI(title="Lenny Growth Assistant API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-Id", str(uuid4()))
    request.state.request_id = request_id
    try:
        response = await call_next(request)
    except AppError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_dict(request_id),
        )
    response.headers["X-Request-Id"] = request_id
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    request_id = getattr(request.state, "request_id", str(uuid4()))
    return JSONResponse(status_code=exc.status_code, content=exc.to_dict(request_id))


@app.get("/health/live")
@app.get("/api/v1/health/live")
async def live():
    return {"status": "ok"}


@app.get("/health/ready")
@app.get("/api/v1/health/ready")
async def ready():
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(
            status_code=503,
            content={
                "error": {
                    "code": "DATABASE_UNAVAILABLE",
                    "message": str(exc),
                    "retryable": True,
                    "request_id": str(uuid4()),
                }
            },
        )


app.include_router(v1_router, prefix="/api/v1")
app.include_router(stream_router, prefix="/api/v1")
