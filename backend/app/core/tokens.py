"""JWT 簽發與驗證（SDS §5.2、§8）。

- Host/Admin：access token（15min）+ refresh token（14d）
- Participant：join 成功後簽發，有效期 = 活動結束 + 24h（無 end_at 時預設 7 天）
"""

from __future__ import annotations

import datetime as dt
import uuid
from dataclasses import dataclass
from typing import Any

import jwt

from app.core.config import Settings, get_settings
from app.core.errors import AppError, ErrorCode
from app.models.enums import UserRole

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_PARTICIPANT = "participant"
TOKEN_TYPE_SCREEN = "screen"


@dataclass(frozen=True, slots=True)
class AccessTokenClaims:
    """Host/Admin access token claims。"""

    user_id: uuid.UUID
    org_id: uuid.UUID
    role: UserRole


@dataclass(frozen=True, slots=True)
class RefreshTokenClaims:
    """Refresh token claims。"""

    user_id: uuid.UUID


@dataclass(frozen=True, slots=True)
class ParticipantTokenClaims:
    """Participant token claims（SDS §5.2）。"""

    participant_id: uuid.UUID
    session_id: uuid.UUID
    room_id: uuid.UUID | None
    anon_allowed: bool


@dataclass(frozen=True, slots=True)
class ScreenTokenClaims:
    """Screen 投影唯讀 token。"""

    room_id: uuid.UUID
    session_id: uuid.UUID
    token_epoch: int


def _settings() -> Settings:
    return get_settings()


def _encode(payload: dict[str, Any], *, expires_delta: dt.timedelta) -> str:
    settings = _settings()
    now = dt.datetime.now(dt.UTC)
    payload = {
        **payload,
        "iat": now,
        "exp": now + expires_delta,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: uuid.UUID, org_id: uuid.UUID, role: UserRole) -> str:
    """簽發 Host/Admin access token。"""
    settings = _settings()
    return _encode(
        {
            "typ": TOKEN_TYPE_ACCESS,
            "sub": str(user_id),
            "org_id": str(org_id),
            "role": role.value,
        },
        expires_delta=dt.timedelta(minutes=settings.jwt_access_ttl_minutes),
    )


def create_refresh_token(*, user_id: uuid.UUID) -> str:
    """簽發 refresh token。"""
    settings = _settings()
    return _encode(
        {"typ": TOKEN_TYPE_REFRESH, "sub": str(user_id)},
        expires_delta=dt.timedelta(days=settings.jwt_refresh_ttl_days),
    )


def create_participant_token(
    *,
    participant_id: uuid.UUID,
    session_id: uuid.UUID,
    room_id: uuid.UUID | None,
    anon_allowed: bool,
    session_end_at: dt.datetime | None,
) -> str:
    """簽發 participant token。"""
    if session_end_at is not None:
        end = session_end_at
        if end.tzinfo is None:
            end = end.replace(tzinfo=dt.UTC)
        expires = end + dt.timedelta(hours=24)
    else:
        expires = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
    ttl = expires - dt.datetime.now(dt.UTC)
    if ttl.total_seconds() <= 0:
        ttl = dt.timedelta(hours=1)
    return _encode(
        {
            "typ": TOKEN_TYPE_PARTICIPANT,
            "participant_id": str(participant_id),
            "session_id": str(session_id),
            "room_id": str(room_id) if room_id else None,
            "anon_allowed": anon_allowed,
        },
        expires_delta=ttl,
    )


def _decode(token: str) -> dict[str, Any]:
    settings = _settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 已過期") from exc
    except jwt.InvalidTokenError as exc:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 無效") from exc


def decode_access_token(token: str) -> AccessTokenClaims:
    """解析並驗證 access token。"""
    payload = _decode(token)
    if payload.get("typ") != TOKEN_TYPE_ACCESS:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 類型錯誤")
    return AccessTokenClaims(
        user_id=uuid.UUID(str(payload["sub"])),
        org_id=uuid.UUID(str(payload["org_id"])),
        role=UserRole(str(payload["role"])),
    )


def decode_refresh_token(token: str) -> RefreshTokenClaims:
    """解析並驗證 refresh token。"""
    payload = _decode(token)
    if payload.get("typ") != TOKEN_TYPE_REFRESH:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 類型錯誤")
    return RefreshTokenClaims(user_id=uuid.UUID(str(payload["sub"])))


def create_screen_token(
    *,
    room_id: uuid.UUID,
    session_id: uuid.UUID,
    session_end_at: dt.datetime | None,
    token_epoch: int,
) -> str:
    """簽發 screen 唯讀 token。"""
    if session_end_at is not None:
        end = session_end_at
        if end.tzinfo is None:
            end = end.replace(tzinfo=dt.UTC)
        expires = end + dt.timedelta(hours=24)
    else:
        expires = dt.datetime.now(dt.UTC) + dt.timedelta(days=7)
    ttl = expires - dt.datetime.now(dt.UTC)
    if ttl.total_seconds() <= 0:
        ttl = dt.timedelta(hours=1)
    return _encode(
        {
            "typ": TOKEN_TYPE_SCREEN,
            "room_id": str(room_id),
            "session_id": str(session_id),
            "token_epoch": token_epoch,
        },
        expires_delta=ttl,
    )


def decode_screen_token(token: str) -> ScreenTokenClaims:
    """解析並驗證 screen token。"""
    payload = _decode(token)
    if payload.get("typ") != TOKEN_TYPE_SCREEN:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 類型錯誤")
    return ScreenTokenClaims(
        room_id=uuid.UUID(str(payload["room_id"])),
        session_id=uuid.UUID(str(payload["session_id"])),
        token_epoch=int(payload.get("token_epoch", 0)),
    )


def decode_participant_token(token: str) -> ParticipantTokenClaims:
    """解析並驗證 participant token。"""
    payload = _decode(token)
    if payload.get("typ") != TOKEN_TYPE_PARTICIPANT:
        raise AppError(ErrorCode.UNAUTHENTICATED, "Token 類型錯誤")
    room_raw = payload.get("room_id")
    return ParticipantTokenClaims(
        participant_id=uuid.UUID(str(payload["participant_id"])),
        session_id=uuid.UUID(str(payload["session_id"])),
        room_id=uuid.UUID(str(room_raw)) if room_raw else None,
        anon_allowed=bool(payload.get("anon_allowed", True)),
    )
