"""匯出檔案 Redis 快取（72h TTL，供 Celery Worker 寫入、API 讀取）。"""

from __future__ import annotations

import base64
import datetime as dt
import logging
import uuid

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

_KEY_PREFIX = "export:data:"


def _key(job_id: uuid.UUID) -> str:
    return f"{_KEY_PREFIX}{job_id}"


async def store_export_file(
    job_id: uuid.UUID,
    content: bytes,
    *,
    expires_at: dt.datetime,
) -> None:
    """寫入匯出 bytes；TTL 對齊 job.expires_at。"""
    redis = await get_redis()
    if redis is None:
        logger.warning("Redis 不可用，略過匯出快取 job=%s", job_id)
        return
    now = dt.datetime.now(dt.UTC)
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=dt.UTC)
    ttl = max(int((exp - now).total_seconds()), 60)
    payload = base64.b64encode(content).decode("ascii")
    await redis.set(_key(job_id), payload, ex=ttl)


async def load_export_file(job_id: uuid.UUID) -> bytes | None:
    """讀取快取匯出；不存在回 None。"""
    redis = await get_redis()
    if redis is None:
        return None
    raw = await redis.get(_key(job_id))
    if not raw:
        return None
    return base64.b64decode(raw.encode("ascii"))


def store_export_file_sync(
    job_id: uuid.UUID,
    content: bytes,
    *,
    expires_at: dt.datetime,
    redis_url: str,
) -> None:
    """Celery task 用同步 Redis 客戶端寫入。"""
    import redis

    client = redis.from_url(redis_url, decode_responses=True)
    now = dt.datetime.now(dt.UTC)
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=dt.UTC)
    ttl = max(int((exp - now).total_seconds()), 60)
    payload = base64.b64encode(content).decode("ascii")
    client.set(_key(job_id), payload, ex=ttl)
    client.close()
