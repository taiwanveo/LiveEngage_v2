"""Auth 業務邏輯。"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.security import verify_secret
from app.core.tokens import create_access_token, create_refresh_token
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse


async def login(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    """Host/Admin 登入（Email + 密碼）。"""
    result = await db.execute(select(User).where(User.email == payload.email))
    user = result.scalar_one_or_none()
    if user is None or not user.password_hash:
        raise AppError(ErrorCode.UNAUTHENTICATED, "帳號或密碼錯誤")
    if not verify_secret(user.password_hash, payload.password):
        raise AppError(ErrorCode.UNAUTHENTICATED, "帳號或密碼錯誤")
    return TokenResponse(
        access_token=create_access_token(
            user_id=user.id, org_id=user.org_id, role=user.role
        ),
        refresh_token=create_refresh_token(user_id=user.id),
    )
