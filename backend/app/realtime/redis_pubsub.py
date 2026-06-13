"""Redis Pub/Sub 橋接（SDS §6.2 ``evt:room:{roomId}``）。

Publisher（REST 寫入端）→ ``PUBLISH evt:room:{id}`` → 各副本 subscriber →
本機 ``ConnectionManager.broadcast``（依 ``target_modes`` 過濾）。
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from typing import Any

from app.core.redis import get_redis
from app.realtime.manager import manager

logger = logging.getLogger(__name__)

CHANNEL_PREFIX = "evt:room:"
STREAM_PREFIX = "stream:room:"
PATTERN = f"{CHANNEL_PREFIX}*"
STREAM_MAXLEN = 1000

_subscriber_task: asyncio.Task[None] | None = None


def room_channel(room_id: str) -> str:
    return f"{CHANNEL_PREFIX}{room_id}"


def room_stream(room_id: str) -> str:
    return f"{STREAM_PREFIX}{room_id}"


async def publish_raw(room_id: str, envelope: dict[str, Any]) -> bool:
    """發布事件至 Redis Pub/Sub + Stream（保留最近 N 筆供 replay）。"""
    redis = await get_redis()
    if redis is None:
        return False
    raw = json.dumps(envelope, default=str)
    pipe = redis.pipeline(transaction=False)
    pipe.publish(room_channel(room_id), raw)
    pipe.xadd(
        room_stream(room_id),
        {"data": raw},
        maxlen=STREAM_MAXLEN,
        approximate=True,
    )
    await pipe.execute()
    return True


async def fetch_replay(
    room_id: str, last_event_id: str | None
) -> list[dict[str, Any]]:
    """讀取斷線後遺漏事件（SDS §6.2）。

    ``last_event_id`` 為 stream entry ID（``ms-seq``），缺省回空清單。
    """
    if not last_event_id:
        return []
    redis = await get_redis()
    if redis is None:
        return []
    entries = await redis.xrange(
        room_stream(room_id), min=f"({last_event_id}", max="+"
    )
    out: list[dict[str, Any]] = []
    for entry_id, fields in entries or []:
        raw = fields.get("data") if isinstance(fields, dict) else None
        if not isinstance(raw, str):
            continue
        try:
            event = json.loads(raw)
        except json.JSONDecodeError:
            continue
        eid = entry_id.decode() if isinstance(entry_id, bytes) else str(entry_id)
        event["_stream_id"] = eid
        out.append(event)
    return out


async def _handle_message(raw: str) -> None:
    try:
        envelope = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("無法解析 Pub/Sub 訊息")
        return

    room_id = str(envelope.get("room_id", ""))
    if not room_id:
        return

    modes_raw = envelope.get("_target_modes")
    target_modes: set[str] | None = None
    if isinstance(modes_raw, list):
        target_modes = {str(m) for m in modes_raw}

    await manager.broadcast(room_id, envelope, target_modes=target_modes)


async def _subscriber_loop() -> None:
    redis = await get_redis()
    if redis is None:
        return

    pubsub = redis.pubsub()
    await pubsub.psubscribe(PATTERN)
    logger.info("Redis Pub/Sub 訂閱已啟動：%s", PATTERN)

    try:
        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            data = message.get("data")
            if isinstance(data, str):
                await _handle_message(data)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Pub/Sub subscriber 異常結束")
    finally:
        await pubsub.punsubscribe(PATTERN)
        await pubsub.aclose()  # type: ignore[no-untyped-call]


def start_subscriber() -> asyncio.Task[None] | None:
    """啟動背景 subscriber（app lifespan）。"""
    global _subscriber_task
    if _subscriber_task is not None and not _subscriber_task.done():
        return _subscriber_task
    _subscriber_task = asyncio.create_task(_subscriber_loop(), name="redis-pubsub")
    return _subscriber_task


async def stop_subscriber() -> None:
    global _subscriber_task
    if _subscriber_task is not None:
        _subscriber_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _subscriber_task
        _subscriber_task = None
