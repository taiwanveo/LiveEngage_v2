"""Auth API（Host/Admin 登入）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.tokens import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.models.user import User
from app.schemas.auth import LoginRequest, RefreshRequest, TokenResponse
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """Host/Admin Email + 密碼登入。"""
    return await auth_service.login(db, payload)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    payload: RefreshRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> TokenResponse:
    """以 refresh token 換發新 access token。"""
    claims = decode_refresh_token(payload.refresh_token)
    result = await db.execute(select(User).where(User.id == claims.user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "使用者不存在")
    return TokenResponse(
        access_token=create_access_token(
            user_id=user.id, org_id=user.org_id, role=user.role
        ),
        refresh_token=create_refresh_token(user_id=user.id),
    )
