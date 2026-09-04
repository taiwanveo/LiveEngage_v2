"""事件型別常數與發布輔助（SDS §6.3）。

Redis 可用時走 Pub/Sub（``evt:room:{roomId}``）跨副本廣播；否則降級程序內 fan-out。
廣播僅做通知（鐵律 1），payload 帶絕對值（鐵律 2）。
"""

from __future__ import annotations

import uuid
from typing import Any

from app.realtime.envelope import EventEnvelope
from app.realtime.manager import manager
from app.realtime.redis_pubsub import publish_raw

# Q&A 事件型別（SDS §6.3）
QUESTION_SUBMITTED = "question_submitted"
QUESTION_APPROVED = "question_approved"
QUESTION_DISMISSED = "question_dismissed"
QUESTION_UPVOTED = "question_upvoted"
QUESTION_DOWNVOTED = "question_downvoted"
QUESTION_HIGHLIGHTED = "question_highlighted"
QUESTION_ANSWERED = "question_answered"
QUESTION_REPLIED = "question_replied"

# Poll 事件型別（SDS §6.3；Sprint 5–6）
POLL_STARTED = "poll_started"
POLL_STOPPED = "poll_stopped"
POLL_LOCKED = "poll_locked"
POLL_UNLOCKED = "poll_unlocked"
POLL_RESULT_REVEALED = "poll_result_revealed"
POLL_RESULT_HIDDEN = "poll_result_hidden"
POLL_RESPONSE_SUBMITTED = "poll_response_submitted"

# Quiz 事件型別（Sprint 9；BE-007 / FE-011）
QUIZ_QUESTION_STARTED = "quiz_question_started"
QUIZ_QUESTION_CLOSED = "quiz_question_closed"
QUIZ_QUESTION_UPDATED = "quiz_question_updated"
QUIZ_LEADERBOARD_UPDATED = "quiz_leaderboard_updated"

# Ideas 事件型別（Sprint 9；FE-013）
IDEA_SUBMITTED = "idea_submitted"
IDEA_REACTED = "idea_reacted"
IDEA_VISIBILITY_CHANGED = "idea_visibility_changed"

# Session 事件（活動生命週期）
SESSION_STARTED = "session_started"
SESSION_ENDED = "session_ended"

# 互動開放（Quiz / Ideas / Survey / Q&A 等；Poll 另用 poll_started）
INTERACTION_STARTED = "interaction_started"

# 接收端 mode 集合
MODE_HOST = {"host"}
MODE_PRESENT_HOST = {"present", "host"}
MODE_SCREEN = {"screen"}
MODE_SCREEN_HOST = {"screen", "host"}
# Poll 即時聚合（文字雲等）廣播至投影、控場與 Screen
MODE_POLL_LIVE_AGG = MODE_PRESENT_HOST | MODE_SCREEN
MODE_ALL = {"participant", "present", "host", "screen"}

# Screen 投影遙控
SCREEN_VIEW_CHANGED = "screen_view_changed"


async def publish(
    room_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
    *,
    target_modes: set[str] | None = None,
) -> None:
    """組裝信封並廣播至房間（Redis Pub/Sub 或本機 fan-out）。"""
    envelope = EventEnvelope(
        type=event_type,
        room_id=room_id,
        payload=payload,
        target_modes=sorted(target_modes) if target_modes else None,
    )
    data = envelope.model_dump(mode="json", by_alias=True)
    room_key = str(room_id)

    # 本機 WS 立即推送，避免僅依賴 Redis Pub/Sub 迴圈導致延遲或漏送
    await manager.broadcast(room_key, data, target_modes=target_modes)
    await publish_raw(room_key, data)
