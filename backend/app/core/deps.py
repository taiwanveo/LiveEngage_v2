"""FastAPI 相依注入：JWT 解析與 RBAC（鐵律 8、SDS §5.2）。"""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.tokens import (
    AccessTokenClaims,
    ParticipantTokenClaims,
    ScreenTokenClaims,
    decode_access_token,
    decode_participant_token,
    decode_screen_token,
)
from app.models.enums import UserRole
from app.models.user import User
from app.core.host_permissions import normalize_role

bearer_scheme = HTTPBearer(auto_error=False)

_ROLE_RANK: dict[UserRole, int] = {
    UserRole.GUEST: 0,
    UserRole.COHOST: 1,
    UserRole.HOST: 2,
    UserRole.MEMBER: 2,  # legacy JWT
    UserRole.ADMIN: 3,
    UserRole.OWNER: 4,
}


async def get_current_user_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AccessTokenClaims:
    """解析 Bearer access token。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")
    return decode_access_token(credentials.credentials)


async def get_current_user(
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[AccessTokenClaims, Depends(get_current_user_claims)],
) -> User:
    """載入目前 Host/Admin 使用者。"""
    result = await db.execute(select(User).where(User.id == claims.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "使用者不存在")
    return user


async def get_screen_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> ScreenTokenClaims:
    """解析 Bearer screen token。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")
    return decode_screen_token(credentials.credentials)


async def get_participant_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> ParticipantTokenClaims:
    """解析 Bearer participant token。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")
    return decode_participant_token(credentials.credentials)


async def get_optional_participant_claims(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> ParticipantTokenClaims | None:
    """選填 participant token；缺少或無效時回 None（供公開列表計算本人投票）。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        return None
    try:
        return decode_participant_token(credentials.credentials)
    except AppError:
        return None


def require_role(min_role: UserRole) -> Callable[..., object]:
    """要求 JWT 角色 >= min_role。"""

    async def _dependency(
        claims: Annotated[AccessTokenClaims, Depends(get_current_user_claims)],
    ) -> AccessTokenClaims:
        if _ROLE_RANK[normalize_role(claims.role)] < _ROLE_RANK[normalize_role(min_role)]:
            raise AppError(ErrorCode.FORBIDDEN, "權限不足")
        return claims

    return _dependency


async def get_request_id(
    x_request_id: Annotated[str | None, Header()] = None,
) -> str:
    """從 header 取得 request_id（供錯誤信封）。"""
    return x_request_id or ""
