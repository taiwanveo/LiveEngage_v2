"""Screen 投影狀態（Redis 快取 + 降級記憶體）。"""

from __future__ import annotations

import datetime as dt
import json
import uuid
from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.redis import get_redis
from app.core.tokens import create_screen_token
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.screen import (
    ScreenDisplayState,
    ScreenStateUpdateRequest,
    ScreenSubView,
    ScreenTokenResponse,
    ScreenViewKind,
)
from app.services import interaction_service

_SCREEN_KEY = "screen:room:{room_id}"
_EPOCH_KEY = "screen:token_epoch:{room_id}"
_TTL_S = 60 * 60 * 24 * 14  # 14 天

_memory_state: dict[str, str] = {}
_memory_epoch: dict[str, int] = {}


def _default_state(
    session: Session, session_title: str | None = None
) -> ScreenDisplayState:
    return ScreenDisplayState(
        view=ScreenViewKind.STANDBY,
        interaction_id=None,
        sub_view=ScreenSubView.QUESTION,
        session_id=session.id,
        session_title=session_title or session.title,
        updated_at=dt.datetime.now(dt.UTC),
    )


async def _get_epoch(room_id: uuid.UUID) -> int:
    key = _EPOCH_KEY.format(room_id=room_id)
    redis = await get_redis()
    if redis is not None:
        raw = await redis.get(key)
        if raw is not None:
            return int(raw)
        return 0
    return _memory_epoch.get(str(room_id), 0)


async def _incr_epoch(room_id: uuid.UUID) -> int:
    key = _EPOCH_KEY.format(room_id=room_id)
    redis = await get_redis()
    if redis is not None:
        val = await redis.incr(key)
        await redis.expire(key, _TTL_S)
        return int(val)
    rid = str(room_id)
    next_epoch = _memory_epoch.get(rid, 0) + 1
    _memory_epoch[rid] = next_epoch
    return next_epoch


async def _load_room_session(
    db: AsyncSession, room_id: uuid.UUID
) -> tuple[Room, Session]:
    result = await db.execute(
        select(Room, Session)
        .join(Session, Room.session_id == Session.id)
        .where(Room.id == room_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到房間")
    return cast(Room, row[0]), cast(Session, row[1])


async def get_display_state(
    db: AsyncSession, *, room_id: uuid.UUID
) -> ScreenDisplayState:
    """讀取投影狀態；不存在時回 standby 預設。"""
    _, session = await _load_room_session(db, room_id)
    key = _SCREEN_KEY.format(room_id=room_id)
    redis = await get_redis()
    raw: str | None = None
    if redis is not None:
        raw = await redis.get(key)
    else:
        raw = _memory_state.get(str(room_id))
    if not raw:
        return _default_state(session)
    data = json.loads(raw)
    return ScreenDisplayState.model_validate(data)


async def _persist_state(room_id: uuid.UUID, state: ScreenDisplayState) -> None:
    key = _SCREEN_KEY.format(room_id=room_id)
    payload = state.model_dump(mode="json")
    raw = json.dumps(payload, default=str)
    redis = await get_redis()
    if redis is not None:
        await redis.set(key, raw, ex=_TTL_S)
    else:
        _memory_state[str(room_id)] = raw


async def set_display_state(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    payload: ScreenStateUpdateRequest,
) -> ScreenDisplayState:
    """Host 更新投影狀態並廣播。"""
    room, session = await _load_room_session(db, room_id)
    await interaction_service.ensure_room_access(db, room.id, host)

    title = payload.session_title if payload.session_title is not None else session.title
    state = ScreenDisplayState(
        view=payload.view,
        interaction_id=payload.interaction_id,
        sub_view=payload.sub_view,
        session_id=session.id,
        session_title=title,
        updated_at=dt.datetime.now(dt.UTC),
    )
    await _persist_state(room_id, state)
    await events.publish(
        room_id,
        events.SCREEN_VIEW_CHANGED,
        state.model_dump(mode="json"),
        target_modes=events.MODE_SCREEN,
    )
    return state


async def create_screen_token_for_room(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
) -> ScreenTokenResponse:
    """簽發 screen 唯讀 token。"""
    room, session = await _load_room_session(db, room_id)
    await interaction_service.ensure_room_access(db, room.id, host)
    epoch = await _get_epoch(room_id)
    token = create_screen_token(
        room_id=room_id,
        session_id=session.id,
        session_end_at=session.end_at,
        token_epoch=epoch,
    )
    if session.end_at is not None:
        end = session.end_at
        if end.tzinfo is None:
            end = end.replace(tzinfo=dt.UTC)
        expires_at = end + dt.timedelta(hours=24)
    else:
        expires_at = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
    return ScreenTokenResponse(token=token, room_id=room_id, expires_at=expires_at)


async def revoke_screen_tokens(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
) -> None:
    """撤銷既有 screen token（遞增 epoch）。"""
    room, _ = await _load_room_session(db, room_id)
    await interaction_service.ensure_room_access(db, room.id, host)
    await _incr_epoch(room_id)


async def validate_screen_token_epoch(room_id: uuid.UUID, token_epoch: int) -> None:
    """驗證 token epoch 未被撤銷。"""
    current = await _get_epoch(room_id)
    if token_epoch < current:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Screen token 已撤銷")
