"""Screen token 唯讀 API 授權（投影端讀取互動資料）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import bearer_scheme
from app.core.errors import AppError, ErrorCode
from app.core.tokens import (
    ScreenTokenClaims,
    decode_access_token,
    decode_screen_token,
)
from app.models.user import User
from app.services import screen_service
from fastapi import Depends
from typing import Annotated
from sqlalchemy import select

from app.core.db import get_session
from app.models.session import Session


@dataclass(frozen=True, slots=True)
class HostOrScreenAuth:
    """Host JWT 或 Screen token（二擇一）。"""

    host: User | None = None
    screen: ScreenTokenClaims | None = None

    @property
    def is_screen(self) -> bool:
        return self.screen is not None


async def _load_host_user(db: AsyncSession, token: str) -> User:
    claims = decode_access_token(token)
    user = await db.get(User, claims.user_id)
    if user is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "使用者不存在")
    return user


async def get_host_or_screen_auth(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> HostOrScreenAuth:
    """解析 Bearer：screen token 或 host access token。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")
    token = credentials.credentials
    try:
        screen = decode_screen_token(token)
        await screen_service.validate_screen_token_epoch(
            screen.room_id, screen.token_epoch
        )
        return HostOrScreenAuth(screen=screen)
    except AppError as exc:
        if exc.code != ErrorCode.UNAUTHENTICATED:
            raise
    host = await _load_host_user(db, token)
    return HostOrScreenAuth(host=host)


async def ensure_screen_room(
    screen: ScreenTokenClaims, room_id: uuid.UUID
) -> None:
    if screen.room_id != room_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權讀取此房間")
    await screen_service.validate_screen_token_epoch(
        screen.room_id, screen.token_epoch
    )


async def ensure_screen_session(
    db: AsyncSession,
    screen: ScreenTokenClaims,
    session_id: uuid.UUID,
    *,
    room_id: uuid.UUID | None = None,
) -> None:
    if screen.session_id != session_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權讀取此活動")
    if room_id is not None and screen.room_id != room_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權讀取此房間")
    await screen_service.validate_screen_token_epoch(
        screen.room_id, screen.token_epoch
    )
    row = await db.execute(select(Session).where(Session.id == session_id))
    if row.scalar_one_or_none() is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到活動")
