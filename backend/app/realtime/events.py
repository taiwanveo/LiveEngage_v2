"""事件型別常數與發布輔助（SDS §6.3）。

目前以程序內 ConnectionManager fan-out；跨副本 Redis Pub/Sub 留待後續。
廣播僅做通知（鐵律 1），payload 帶絕對值（鐵律 2）。
"""

from __future__ import annotations

import uuid
from typing import Any

from app.realtime.envelope import EventEnvelope
from app.realtime.manager import manager

# Q&A 事件型別（SDS §6.3）
QUESTION_SUBMITTED = "question_submitted"
QUESTION_APPROVED = "question_approved"
QUESTION_DISMISSED = "question_dismissed"
QUESTION_UPVOTED = "question_upvoted"
QUESTION_DOWNVOTED = "question_downvoted"
QUESTION_HIGHLIGHTED = "question_highlighted"
QUESTION_ANSWERED = "question_answered"

# 接收端 mode 集合
MODE_HOST = {"host"}
MODE_ALL = {"participant", "present", "host"}


async def publish(
    room_id: uuid.UUID,
    event_type: str,
    payload: dict[str, Any],
    *,
    target_modes: set[str] | None = None,
) -> None:
    """組裝信封並廣播至房間（依 mode 過濾）。"""
    envelope = EventEnvelope(type=event_type, room_id=room_id, payload=payload)
    await manager.broadcast(
        str(room_id),
        envelope.model_dump(mode="json"),
        target_modes=target_modes,
    )
