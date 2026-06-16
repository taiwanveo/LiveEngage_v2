"""Poll Redis 操作：房間分散式鎖、聚合 hash、提交 rate limit、廣播節流（SDS §4.6、§5.4）。

房間鎖：``lock:room:{roomId}:active_poll``（SET NX PX 5000 → Lua CAS DEL）
聚合 hash：``agg:poll:{interactionId}``（欄位依題型）
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from typing import Any

from app.core.errors import AppError, ErrorCode
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

# ── 房間鎖 ─────────────────────────────────────────────────────────

_LOCK_PREFIX = "lock:room:"
_LOCK_SUFFIX = ":active_poll"
LOCK_TTL_MS = 5000
_MAX_LOCK_RETRIES = 3
_LOCK_RETRY_DELAY_MS = 80

# Lua CAS DEL：只有 token 匹配才刪除，避免誤刪他人持有的鎖
_RELEASE_SCRIPT = """
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
"""


def _lock_key(room_id: uuid.UUID) -> str:
    return f"{_LOCK_PREFIX}{room_id}{_LOCK_SUFFIX}"


async def acquire_room_lock(room_id: uuid.UUID) -> str | None:
    """嘗試取得房間鎖；成功回 token（釋放用）；Redis 不可用回 None（降級）。

    最多重試 _MAX_LOCK_RETRIES 次，仍失敗拋 POLL_LOCKED 409。
    """
    redis = await get_redis()
    if redis is None:
        return None  # 降級：僅靠 DB partial unique 保護

    token = str(uuid.uuid4())
    key = _lock_key(room_id)

    for attempt in range(_MAX_LOCK_RETRIES):
        result = await redis.set(key, token, nx=True, px=LOCK_TTL_MS)
        if result:
            return token
        if attempt < _MAX_LOCK_RETRIES - 1:
            await asyncio.sleep(_LOCK_RETRY_DELAY_MS / 1000)

    raise AppError(ErrorCode.POLL_LOCKED, "房間目前有另一個 Poll 正在操作中，請稍後再試")


async def release_room_lock(room_id: uuid.UUID, token: str) -> None:
    """以 Lua CAS DEL 釋放房間鎖（token 不符則忽略，鎖過期亦安全）。"""
    redis = await get_redis()
    if redis is None:
        return
    key = _lock_key(room_id)
    with contextlib.suppress(Exception):
        await redis.eval(_RELEASE_SCRIPT, 1, key, token)


# ── 聚合 hash ──────────────────────────────────────────────────────

_AGG_PREFIX = "agg:poll:"
_AGG_TTL_S = 86400  # 24h（停止後保留供 results 快取）


def _agg_key(interaction_id: uuid.UUID) -> str:
    return f"{_AGG_PREFIX}{interaction_id}"


async def increment_option_count(
    interaction_id: uuid.UUID, option_id: str, delta: int = 1
) -> None:
    """multiple_choice / ranking / word_cloud：增減選項計數。"""
    redis = await get_redis()
    if redis is None:
        return
    await redis.hincrby(_agg_key(interaction_id), option_id, delta)


async def increment_rating_agg(
    interaction_id: uuid.UUID,
    value: int,
    old_value: int | None = None,
) -> None:
    """rating 題型聚合：new vote / update vote。

    - ``old_value is None``：新投（count+1, sum+=value）。
    - ``old_value is not None``：更改（sum 差量）。
    """
    redis = await get_redis()
    if redis is None:
        return
    key = _agg_key(interaction_id)
    pipe = redis.pipeline(transaction=False)
    if old_value is None:
        pipe.hincrby(key, "sum", value)
        pipe.hincrby(key, "count", 1)
    else:
        pipe.hincrby(key, "sum", value - old_value)
    await pipe.execute()


async def get_poll_agg(interaction_id: uuid.UUID) -> dict[str, str]:
    """讀聚合 hash；Redis 不可用時回空 dict（呼叫端 fallback DB）。"""
    redis = await get_redis()
    if redis is None:
        return {}
    raw: object = await redis.hgetall(_agg_key(interaction_id))
    if not isinstance(raw, dict):
        return {}
    return {str(k): str(v) for k, v in raw.items()}


async def clear_poll_agg(interaction_id: uuid.UUID) -> None:
    """reset 時清除聚合（含設定 TTL 防殘留）。"""
    redis = await get_redis()
    if redis is None:
        return
    with contextlib.suppress(Exception):
        await redis.delete(_agg_key(interaction_id))


async def set_poll_agg_ttl(interaction_id: uuid.UUID) -> None:
    """stop 後設 TTL，讓 results 仍可從 Redis 快速讀取。"""
    redis = await get_redis()
    if redis is None:
        return
    with contextlib.suppress(Exception):
        await redis.expire(_agg_key(interaction_id), _AGG_TTL_S)


# ── 提交 rate limit（FE-006~010 作答端點；S5-3 呼叫）────────────────

_SUBMIT_RATE_PREFIX = "poll:rate:submit:"
SUBMIT_RATE_LIMIT = 10
SUBMIT_RATE_WINDOW_S = 60


async def check_poll_submit_rate_limit(
    participant_id: uuid.UUID,
    *,
    limit: int | None = None,
) -> None:
    """作答 10/min/participant（SDS §8）。"""
    from app.schemas.rate_limit import DEFAULT_RATE_LIMITS

    max_count = limit if limit is not None else DEFAULT_RATE_LIMITS.poll_submit_per_min
    from app.services.rate_limit_service import check_rate

    await check_rate(
        f"poll:rate:submit:{participant_id}",
        limit=max_count,
        message=f"提交過於頻繁，每 60 秒最多 {max_count} 次",
    )


# ── 結果廣播節流（≥250ms 合併，仿 qa_redis；S5-3 呼叫）───────────────

_RESULT_THROTTLE_PREFIX = "poll:broadcast_throttle:"
RESULT_BROADCAST_THROTTLE_MS = 250

_pending_result_tasks: dict[str, asyncio.Task[None]] = {}


async def _do_broadcast_result(
    room_id: uuid.UUID,
    interaction_id: uuid.UUID,
    payload: dict[str, Any],
) -> None:
    from app.realtime import events

    await asyncio.sleep(RESULT_BROADCAST_THROTTLE_MS / 1000)
    key = str(interaction_id)
    _pending_result_tasks.pop(key, None)
    try:
        await events.publish(
            room_id,
            events.POLL_RESPONSE_SUBMITTED,
            payload,
            target_modes=events.MODE_POLL_LIVE_AGG,
        )
    except Exception:
        logger.exception("結果廣播失敗 interaction=%s", interaction_id)


async def throttled_broadcast_result(
    room_id: uuid.UUID,
    interaction_id: uuid.UUID,
    payload: dict[str, Any],
) -> None:
    """節流廣播 poll_response_submitted；相同 interaction 250ms 內只送一次。"""
    key = str(interaction_id)
    existing = _pending_result_tasks.get(key)
    if existing and not existing.done():
        existing.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await existing

    task = asyncio.create_task(
        _do_broadcast_result(room_id, interaction_id, payload)
    )
    _pending_result_tasks[key] = task
