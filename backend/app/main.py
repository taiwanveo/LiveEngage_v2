"""FastAPI 應用進入點（app factory）。

提供 ``/health``（liveness）與 ``/ready``（readiness，含 DB 連線檢查）。
"""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import get_sessionmaker
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging


def create_app() -> FastAPI:
    """建立並設定 FastAPI 應用。"""
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="LiveEngage API",
        version="0.1.0",
        description="LiveEngage（即時互動通）後端 API。",
    )

    register_error_handlers(app)
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    async def health() -> dict[str, str]:
        """Liveness：行程存活即回 ok。"""
        return {"status": "ok", "env": settings.env}

    @app.get("/ready", tags=["health"])
    async def ready() -> JSONResponse:
        """Readiness：檢查 DB 連線是否就緒。"""
        payload: dict[str, Any] = {"status": "ok", "checks": {"database": "ok"}}
        try:
            sessionmaker = get_sessionmaker()
            async with sessionmaker() as session:
                await session.execute(text("SELECT 1"))
        except Exception as exc:  # noqa: BLE001 - readiness 需回報任何失敗
            payload["status"] = "degraded"
            payload["checks"]["database"] = f"error: {type(exc).__name__}"
            return JSONResponse(status_code=503, content=payload)
        return JSONResponse(status_code=200, content=payload)

    return app


app = create_app()
