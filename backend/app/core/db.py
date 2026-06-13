"""資料庫連線：async engine 與 session factory。"""

from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.config import get_settings

_engine: AsyncEngine | None = None
_sessionmaker: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """惰性建立並回傳全域 async engine。"""
    global _engine
    if _engine is None:
        settings = get_settings()
        # Neon / 測試環境用 NullPool，避免 event loop 與連線池衝突
        use_null_pool = settings.env == "dev" or "neon.tech" in settings.database_url
        _engine = create_async_engine(
            settings.database_url,
            echo=settings.debug,
            pool_pre_ping=True,
            poolclass=NullPool if use_null_pool else None,
        )
    return _engine


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    """回傳 async session factory。"""
    global _sessionmaker
    if _sessionmaker is None:
        _sessionmaker = async_sessionmaker(
            bind=get_engine(),
            expire_on_commit=False,
            autoflush=False,
        )
    return _sessionmaker


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI 相依：提供一個 async DB session。"""
    sessionmaker = get_sessionmaker()
    async with sessionmaker() as session:
        yield session
