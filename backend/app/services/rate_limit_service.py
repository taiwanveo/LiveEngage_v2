"""共用 rate limit（Redis 滑動視窗計數，SDS §4.6）。"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.redis import get_redis
from app.models.organization import Organization
from app.models.room import Room
from app.models.session import Session
from app.schemas.rate_limit import DEFAULT_RATE_LIMITS, RateLimitSettings, parse_rate_limits

logger = logging.getLogger(__name__)

_WINDOW_S = 60


async def limits_for_room(db: AsyncSession, room_id: uuid.UUID) -> RateLimitSettings:
    """自 room 所屬 org 讀取 rate_limit 覆寫。"""
    result = await db.execute(
        select(Organization.settings_jsonb)
        .select_from(Room)
        .join(Session, Room.session_id == Session.id)
        .join(Organization, Session.org_id == Organization.id)
        .where(Room.id == room_id)
    )
    raw = result.scalar_one_or_none()
    return parse_rate_limits(raw if isinstance(raw, dict) else None)


async def check_rate(
    key: str,
    *,
    limit: int,
    window_s: int = _WINDOW_S,
    message: str = "請求過於頻繁，請稍後再試",
) -> None:
    """固定視窗計數；超過 limit 拋 RATE_LIMITED。"""
    redis = await get_redis()
    if redis is None:
        return

    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, window_s)
    if count > limit:
        raise AppError(ErrorCode.RATE_LIMITED, message)


async def check_passcode_attempt(client_ip: str, limits: RateLimitSettings | None = None) -> None:
    """Passcode 驗證 5/min/IP（join 端點）。"""
    lim = limits or DEFAULT_RATE_LIMITS
    await check_rate(
        f"rl:passcode:{client_ip}",
        limit=lim.passcode_per_min_per_ip,
        message=f"Passcode 嘗試過於頻繁，每 {_WINDOW_S} 秒最多 {lim.passcode_per_min_per_ip} 次",
    )


async def check_by_code_lookup(client_ip: str, limits: RateLimitSettings | None = None) -> None:
    """by-code 查詢 30/min/IP。"""
    lim = limits or DEFAULT_RATE_LIMITS
    await check_rate(
        f"rl:bycode:{client_ip}",
        limit=lim.by_code_per_min_per_ip,
        message=f"查詢過於頻繁，每 { _WINDOW_S } 秒最多 {lim.by_code_per_min_per_ip} 次",
    )
