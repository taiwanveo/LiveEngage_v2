"""Audit log 寫入（鐵律 10）。

審核／控場／高亮／匯出／設定變更等敏感動作呼叫 :func:`log` 留痕。
本檔不負責讀取（查詢由匯出 / Admin 端依需要實作）。
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ids import uuid7
from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def log(
    db: AsyncSession,
    *,
    actor: User | None,
    action: str,
    target_type: str,
    target_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    room_id: uuid.UUID | None = None,
    details: dict[str, Any] | None = None,
) -> None:
    """寫一筆 audit log（不 commit；交由呼叫端與業務 commit 同 transaction）。"""
    entry = AuditLog(
        id=uuid7(),
        org_id=actor.org_id if actor else None,
        actor_user_id=actor.id if actor else None,
        session_id=session_id,
        room_id=room_id,
        target_type=target_type,
        target_id=target_id,
        action=action,
        details_jsonb=dict(details or {}),
    )
    db.add(entry)
