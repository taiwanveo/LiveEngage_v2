"""FastAPI 應用進入點（app factory）。

提供 ``/health``（liveness）與 ``/ready``（readiness，含 DB / Redis 連線檢查）。
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.errors import register_error_handlers
from app.core.idempotency import IdempotencyMiddleware
from app.core.logging import configure_logging
from app.core.redis import close_redis, ping_redis
from app.realtime.redis_pubsub import start_subscriber, stop_subscriber
from app.services.qa_redis import start_flush_worker, stop_flush_worker


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """啟動 Redis Pub/Sub subscriber 與 Q&A flush worker。"""
    sessionmaker = get_sessionmaker()
    start_subscriber()
    start_flush_worker(sessionmaker)
    yield
    await stop_flush_worker()
    await stop_subscriber()
    await close_redis()


def create_app() -> FastAPI:
    """建立並設定 FastAPI 應用。"""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="LiveEngage API",
        version="0.1.0",
        description="LiveEngage（即時互動通）後端 API。",
        lifespan=lifespan,
    )

    register_error_handlers(app)
    app.add_middleware(IdempotencyMiddleware)
    app.include_router(api_router)

    from app.realtime.gateway import router as ws_router

    app.include_router(ws_router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        """Liveness：行程存活即回 ok。"""
        return {"status": "ok", "env": settings.env}

    @app.get("/ready", tags=["health"])
    async def ready() -> JSONResponse:
        """Readiness：檢查 DB 與 Redis 連線是否就緒。"""
        payload: dict[str, Any] = {
            "status": "ok",
            "checks": {"database": "ok", "redis": "ok"},
        }
        status_code = 200

        try:
            sessionmaker = get_sessionmaker()
            async with sessionmaker() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001
            payload["status"] = "degraded"
            payload["checks"]["database"] = f"error: {type(exc).__name__}"
            status_code = 503

        if not await ping_redis():
            payload["status"] = "degraded"
            payload["checks"]["redis"] = "unavailable"
            # Redis 降級仍可服務（in-memory fan-out），不強制 503

        return JSONResponse(status_code=status_code, content=payload)

    return app


app = create_app()
