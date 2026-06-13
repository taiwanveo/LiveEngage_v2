"""Redis 連線（Upstash / 本地 docker-compose）。

使用 ``redis.asyncio`` 協定連線（``rediss://`` 支援 Upstash TLS）。
REST API（``UPSTASH_REDIS_REST_*``）不支援 Pub/Sub，本專案不使用。
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.core.config import get_settings

if TYPE_CHECKING:
    from redis.asyncio import Redis

logger = logging.getLogger(__name__)

_redis: Redis | None = None
_redis_available: bool | None = None


async def get_redis() -> Redis | None:
    """回傳 Redis 客戶端；連線失敗時回 None（降級 in-memory）。"""
    global _redis, _redis_available
    if _redis_available is False:
        return None
    if _redis is not None:
        return _redis

    from redis.asyncio import Redis

    settings = get_settings()
    try:
        client: Redis = Redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
        )
        await client.ping()
        _redis = client
        _redis_available = True
        logger.info("Redis 連線成功")
        return _redis
    except Exception:
        logger.warning("Redis 不可用，降級為程序內 fan-out", exc_info=True)
        _redis_available = False
        return None


async def ping_redis() -> bool:
    """Health check 用。"""
    client = await get_redis()
    if client is None:
        return False
    try:
        await client.ping()
        return True
    except Exception:
        return False


async def close_redis() -> None:
    """關閉連線池（應用 shutdown）。"""
    global _redis, _redis_available
    if _redis is not None:
        await _redis.aclose()
    _redis = None
    _redis_available = None


def reset_redis_for_tests() -> None:
    """測試用：重置全域狀態。"""
    global _redis, _redis_available
    _redis = None
    _redis_available = None


def disable_redis_for_tests() -> None:
    """整合測試用：跳過 Redis 連線與背景 task。"""
    global _redis, _redis_available
    _redis = None
    _redis_available = False
