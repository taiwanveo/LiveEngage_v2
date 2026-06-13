"""Auth API（Host/Admin 登入）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse
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
from app.schemas.sso import (
    SsoConfigResponse,
    SsoExchangeRequest,
    SsoExchangeResponse,
    SsoParticipantJoinRequest,
    SsoParticipantJoinResponse,
)
from app.services import auth_service, session_service, sso_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/sso/config", response_model=SsoConfigResponse)
async def sso_config() -> SsoConfigResponse:
    """前端判斷是否顯示 SSO 登入按鈕。"""
    cfg = sso_service.get_public_config()
    return SsoConfigResponse(
        enabled=cfg.enabled,
        provider=cfg.provider,
        label=cfg.label,
    )


@router.get("/sso/oidc/authorize")
async def sso_oidc_authorize(
    app: Annotated[str, Query(pattern="^(host|admin|participant)$")] = "host",
    return_to: str = "",
) -> RedirectResponse:
    """導向 OIDC IdP 授權頁。"""
    url = await sso_service.build_authorize_redirect_url(app=app, return_to=return_to)
    return RedirectResponse(url, status_code=302)


@router.get("/sso/oidc/callback")
async def sso_oidc_callback(
    code: str,
    state: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> RedirectResponse:
    """OIDC redirect_uri；完成後導回前端 hash callback。"""
    redirect_url = await sso_service.complete_oidc_callback(db, code=code, state=state)
    return RedirectResponse(redirect_url, status_code=302)


@router.post("/sso/exchange", response_model=SsoExchangeResponse)
async def sso_exchange(payload: SsoExchangeRequest) -> SsoExchangeResponse:
    """以 callback ticket 換取 JWT（一次性）。"""
    tokens = await sso_service.exchange_ticket(payload.ticket)
    return SsoExchangeResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
    )


@router.post("/sso/participant-join", response_model=SsoParticipantJoinResponse)
async def sso_participant_join(
    payload: SsoParticipantJoinRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SsoParticipantJoinResponse:
    """Participant SSO ticket 換取 participant token 並加入活動。"""
    profile = await sso_service.exchange_participant_ticket(payload.ticket)
    joined = await session_service.join_with_sso(
        db,
        session_id=payload.session_id,
        email=profile.email,
        name=profile.name,
    )
    return SsoParticipantJoinResponse(
        participant_token=joined.participant_token,
        session_id=joined.session_id,
        room_id=joined.room_id,
        participant_id=joined.participant_id,
        display_name=joined.display_name,
        email=joined.email,
    )


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
