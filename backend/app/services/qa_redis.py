"""Q&A Redis 計數、廣播節流、提問 rate limit（SDS §5.5、§4.6）。"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import uuid
from typing import Any

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.redis import get_redis
from app.models.question import Question
from app.realtime import events
from app.services.rate_limit_service import check_rate

logger = logging.getLogger(__name__)

_WINDOW_S = 60

# Redis key 命名
_FLUSH_SET = "qa:flush_queue"
_PENDING_PREFIX = "qa:pending:"
_VOTE_THROTTLE_PREFIX = "qa:vote_throttle:"
_QUESTION_RATE_PREFIX = "qa:rate:question:"
_UPVOTE_RATE_PREFIX = "qa:rate:upvote:"

FLUSH_INTERVAL_S = 2.0
VOTE_BROADCAST_THROTTLE_MS = 300
QUESTION_RATE_LIMIT = 5
QUESTION_RATE_WINDOW_S = 60
UPVOTE_RATE_LIMIT = 30
UPVOTE_RATE_WINDOW_S = 60

_flush_task: asyncio.Task[None] | None = None


def _pending_key(question_id: uuid.UUID) -> str:
    return f"{_PENDING_PREFIX}{question_id}"


async def check_question_rate_limit(
    participant_id: uuid.UUID,
    *,
    limit: int | None = None,
) -> None:
    """提問 5/min/participant（FE-004-FR8）。"""
    from app.schemas.rate_limit import DEFAULT_RATE_LIMITS

    max_count = limit if limit is not None else DEFAULT_RATE_LIMITS.question_per_min
    await check_rate(
        f"qa:rate:question:{participant_id}",
        limit=max_count,
        message=f"提問過於頻繁，每 {_WINDOW_S} 秒最多 {max_count} 題",
    )


async def check_upvote_rate_limit(
    participant_id: uuid.UUID,
    *,
    limit: int | None = None,
) -> None:
    """投票 30/min/participant（SDS §4.6）。"""
    from app.schemas.rate_limit import DEFAULT_RATE_LIMITS

    max_count = limit if limit is not None else DEFAULT_RATE_LIMITS.upvote_per_min
    await check_rate(
        f"qa:rate:upvote:{participant_id}",
        limit=max_count,
        message=f"投票過於頻繁，每 {_WINDOW_S} 秒最多 {max_count} 次",
    )


async def record_vote_deltas(
    question_id: uuid.UUID,
    *,
    delta_up: int,
    delta_down: int,
) -> None:
    """記錄待 flush 的計數增量（Redis HINCRBY）。"""
    redis = await get_redis()
    if redis is None or (delta_up == 0 and delta_down == 0):
        return

    pk = _pending_key(question_id)
    if delta_up:
        await redis.hincrby(pk, "up", delta_up)
    if delta_down:
        await redis.hincrby(pk, "down", delta_down)
    await redis.sadd(_FLUSH_SET, str(question_id))


async def get_effective_counts(
    db: AsyncSession, question: Question
) -> tuple[int, int, int]:
    """DB 計數 + Redis 待 flush 增量 = 對外顯示值。"""
    up = question.upvote_count
    down = question.downvote_count
    redis = await get_redis()
    if redis is None:
        return up, down, question.score

    pending = await redis.hgetall(_pending_key(question.id))
    if pending:
        up += int(pending.get("up", 0))
        down += int(pending.get("down", 0))
    return up, down, up - down


async def apply_vote_counts_to_db(
    db: AsyncSession,
    question_id: uuid.UUID,
    *,
    delta_up: int,
    delta_down: int,
) -> None:
    """無 Redis 時直接更新 DB；有 Redis 時只寫增量至 Redis。"""
    redis = await get_redis()
    if redis is not None:
        await record_vote_deltas(question_id, delta_up=delta_up, delta_down=delta_down)
        return

    await db.execute(
        update(Question)
        .where(Question.id == question_id)
        .values(
            upvote_count=Question.upvote_count + delta_up,
            downvote_count=Question.downvote_count + delta_down,
        )
    )


async def flush_pending_counts(sessionmaker: async_sessionmaker[AsyncSession]) -> int:
    """批次回寫 Redis 待 flush 計數至 DB（SDS §5.5）。"""
    redis = await get_redis()
    if redis is None:
        return 0

    qids = await redis.smembers(_FLUSH_SET)
    if not qids:
        return 0

    flushed = 0
    async with sessionmaker() as db:
        for qid_str in qids:
            qid_text = qid_str.decode() if isinstance(qid_str, bytes) else str(qid_str)
            try:
                qid = uuid.UUID(qid_text)
            except ValueError:
                await redis.srem(_FLUSH_SET, qid_str)
                continue

            pk = _pending_key(qid)
            pending = await redis.hgetall(pk)
            delta_up = int(pending.get("up", 0))
            delta_down = int(pending.get("down", 0))
            if delta_up == 0 and delta_down == 0:
                await redis.srem(_FLUSH_SET, qid_str)
                continue

            await db.execute(
                update(Question)
                .where(Question.id == qid)
                .values(
                    upvote_count=Question.upvote_count + delta_up,
                    downvote_count=Question.downvote_count + delta_down,
                )
            )
            await db.commit()

            # 扣除已 flush 的增量
            if delta_up:
                await redis.hincrby(pk, "up", -delta_up)
            if delta_down:
                await redis.hincrby(pk, "down", -delta_down)
            await redis.srem(_FLUSH_SET, qid_str)
            flushed += 1

    return flushed


async def _flush_loop(sessionmaker: async_sessionmaker[AsyncSession]) -> None:
    while True:
        try:
            await asyncio.sleep(FLUSH_INTERVAL_S)
            count = await flush_pending_counts(sessionmaker)
            if count:
                logger.debug("Q&A flush 回寫 %d 題", count)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Q&A flush loop 錯誤")


def start_flush_worker(
    sessionmaker: async_sessionmaker[AsyncSession],
) -> asyncio.Task[None] | None:
    global _flush_task
    if _flush_task is not None and not _flush_task.done():
        return _flush_task
    _flush_task = asyncio.create_task(_flush_loop(sessionmaker), name="qa-flush")
    return _flush_task


async def stop_flush_worker() -> None:
    global _flush_task
    if _flush_task is not None:
        _flush_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _flush_task
        _flush_task = None


async def publish_vote_event_throttled(
    room_id: uuid.UUID,
    question_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
) -> None:
    """投票廣播節流：同一題 ≥300ms 合併最新 payload（SDS §5.5）。"""
    redis = await get_redis()
    if redis is None:
        await events.publish(room_id, event_type, payload, target_modes=events.MODE_ALL)
        return

    import json

    latest_key = f"qa:vote_latest:{question_id}"
    await redis.set(
        latest_key,
        json.dumps({"event_type": event_type, "payload": payload}, default=str),
        ex=30,
    )

    throttle_key = f"{_VOTE_THROTTLE_PREFIX}{question_id}"
    if await redis.set(throttle_key, "1", nx=True, px=VOTE_BROADCAST_THROTTLE_MS):
        asyncio.create_task(
            _debounced_vote_broadcast(room_id, question_id),
            name=f"vote-debounce-{question_id}",
        )


async def _debounced_vote_broadcast(
    room_id: uuid.UUID, question_id: uuid.UUID
) -> None:
    """等待節流窗口後發送最新累積 payload。"""
    import json

    await asyncio.sleep(VOTE_BROADCAST_THROTTLE_MS / 1000.0)
    redis = await get_redis()
    if redis is None:
        return
    raw = await redis.get(f"qa:vote_latest:{question_id}")
    if not raw:
        return
    data = json.loads(raw)
    await events.publish(
        room_id,
        str(data["event_type"]),
        dict(data["payload"]),
        target_modes=events.MODE_ALL,
    )
