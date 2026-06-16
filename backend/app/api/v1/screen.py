"""Screen 投影遙控 API（Room 級 display state + screen token）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import bearer_scheme, get_current_user
from app.core.errors import AppError, ErrorCode
from app.core.tokens import decode_access_token, decode_screen_token
from app.models.user import User
from app.schemas.screen import (
    ScreenDisplayState,
    ScreenStateUpdateRequest,
    ScreenTokenResponse,
    ScreenTokenRevokeResponse,
)
from app.services import interaction_service, screen_service

router = APIRouter(tags=["screen"])


def _parse_bearer(
    credentials: HTTPAuthorizationCredentials | None,
) -> str:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")
    return credentials.credentials


async def _authorize_screen_read(
    db: AsyncSession,
    room_id: uuid.UUID,
    credentials: HTTPAuthorizationCredentials | None,
) -> None:
    """Screen token 或 Host access token 可讀投影狀態。"""
    raw = _parse_bearer(credentials)
    try:
        claims = decode_screen_token(raw)
        if claims.room_id != room_id:
            raise AppError(ErrorCode.FORBIDDEN, "無權讀取此房間投影狀態")
        await screen_service.validate_screen_token_epoch(room_id, claims.token_epoch)
        return
    except AppError as exc:
        if exc.code != ErrorCode.UNAUTHENTICATED:
            raise
    access = decode_access_token(raw)
    host = await db.get(User, access.user_id)
    if host is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "使用者不存在")
    await interaction_service.ensure_room_access(db, room_id, host)


@router.get("/rooms/{room_id}/screen", response_model=ScreenDisplayState)
async def get_screen_state(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> ScreenDisplayState:
    """讀取目前投影狀態（screen token 或 Host）。"""
    await _authorize_screen_read(db, room_id, credentials)
    return await screen_service.get_display_state(db, room_id=room_id)


@router.put("/rooms/{room_id}/screen", response_model=ScreenDisplayState)
async def update_screen_state(
    room_id: uuid.UUID,
    payload: ScreenStateUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> ScreenDisplayState:
    """Host 更新投影狀態（支援 Idempotency-Key middleware）。"""
    return await screen_service.set_display_state(
        db, room_id=room_id, host=host, payload=payload
    )


@router.post(
    "/rooms/{room_id}/screen-token",
    response_model=ScreenTokenResponse,
)
async def mint_screen_token(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> ScreenTokenResponse:
    """簽發 screen 唯讀 token（Host）。"""
    return await screen_service.create_screen_token_for_room(
        db, room_id=room_id, host=host
    )


@router.post(
    "/rooms/{room_id}/screen-token/revoke",
    response_model=ScreenTokenRevokeResponse,
)
async def revoke_screen_token(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> ScreenTokenRevokeResponse:
    """撤銷既有 screen token（遞增 epoch）。"""
    await screen_service.revoke_screen_tokens(db, room_id=room_id, host=host)
    return ScreenTokenRevokeResponse()
