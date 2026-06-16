"""OIDC SSO 登入（Host / Admin）。"""

from __future__ import annotations

import datetime as dt
import json
import logging
import secrets
import uuid
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote, urlencode

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.redis import get_redis
from app.core.tokens import create_access_token, create_refresh_token
from app.models.enums import UserRole
from app.models.organization import Organization
from app.models.user import User
from app.schemas.auth import TokenResponse

logger = logging.getLogger(__name__)

_STATE_TTL_SECONDS = 600
_TICKET_TTL_SECONDS = 120
_DISCOVERY_CACHE: dict[str, tuple[dt.datetime, dict[str, Any]]] = {}
_MEMORY_STATES: dict[str, tuple[dt.datetime, dict[str, str]]] = {}
_MEMORY_TICKETS: dict[str, tuple[dt.datetime, TokenResponse]] = {}
_MEMORY_PARTICIPANT_TICKETS: dict[str, tuple[dt.datetime, dict[str, str]]] = {}


@dataclass(frozen=True)
class SsoParticipantProfile:
    email: str
    name: str | None


@dataclass(frozen=True)
class SsoPublicConfig:
    enabled: bool
    provider: str
    label: str


def get_public_config() -> SsoPublicConfig:
    settings = get_settings()
    if not settings.sso_enabled:
        return SsoPublicConfig(enabled=False, provider="oidc", label="SSO 登入")
    return SsoPublicConfig(
        enabled=True,
        provider="oidc",
        label=settings.sso_button_label,
    )


def _now() -> dt.datetime:
    return dt.datetime.now(dt.UTC)


def _purge_memory(store: dict[str, tuple[dt.datetime, Any]]) -> None:
    cutoff = _now()
    expired = [k for k, (exp, _) in store.items() if exp <= cutoff]
    for k in expired:
        store.pop(k, None)


async def _store_state(state: str, payload: dict[str, str]) -> None:
    expires = _now() + dt.timedelta(seconds=_STATE_TTL_SECONDS)
    redis = await get_redis()
    if redis is not None:
        await redis.setex(
            f"sso:state:{state}",
            _STATE_TTL_SECONDS,
            json.dumps(payload),
        )
        return
    _purge_memory(_MEMORY_STATES)
    _MEMORY_STATES[state] = (expires, payload)


async def _pop_state(state: str) -> dict[str, str] | None:
    redis = await get_redis()
    if redis is not None:
        raw = await redis.get(f"sso:state:{state}")
        if raw is None:
            return None
        await redis.delete(f"sso:state:{state}")
        return json.loads(raw)
    _purge_memory(_MEMORY_STATES)
    item = _MEMORY_STATES.pop(state, None)
    if item is None:
        return None
    expires, payload = item
    if expires <= _now():
        return None
    return payload


async def _store_ticket(ticket: str, tokens: TokenResponse) -> None:
    expires = _now() + dt.timedelta(seconds=_TICKET_TTL_SECONDS)
    redis = await get_redis()
    if redis is not None:
        await redis.setex(
            f"sso:ticket:{ticket}",
            _TICKET_TTL_SECONDS,
            tokens.model_dump_json(),
        )
        return
    _purge_memory(_MEMORY_TICKETS)
    _MEMORY_TICKETS[ticket] = (expires, tokens)


async def _pop_ticket(ticket: str) -> TokenResponse | None:
    redis = await get_redis()
    if redis is not None:
        raw = await redis.get(f"sso:ticket:{ticket}")
        if raw is None:
            return None
        await redis.delete(f"sso:ticket:{ticket}")
        return TokenResponse.model_validate_json(raw)
    _purge_memory(_MEMORY_TICKETS)
    item = _MEMORY_TICKETS.pop(ticket, None)
    if item is None:
        return None
    expires, tokens = item
    if expires <= _now():
        return None
    return tokens


async def _store_participant_ticket(ticket: str, profile: dict[str, str]) -> None:
    expires = _now() + dt.timedelta(seconds=_TICKET_TTL_SECONDS)
    redis = await get_redis()
    if redis is not None:
        await redis.setex(
            f"sso:pticket:{ticket}",
            _TICKET_TTL_SECONDS,
            json.dumps(profile),
        )
        return
    _purge_memory(_MEMORY_PARTICIPANT_TICKETS)
    _MEMORY_PARTICIPANT_TICKETS[ticket] = (expires, profile)


async def _pop_participant_ticket(ticket: str) -> dict[str, str] | None:
    redis = await get_redis()
    if redis is not None:
        raw = await redis.get(f"sso:pticket:{ticket}")
        if raw is None:
            return None
        await redis.delete(f"sso:pticket:{ticket}")
        return json.loads(raw)
    _purge_memory(_MEMORY_PARTICIPANT_TICKETS)
    item = _MEMORY_PARTICIPANT_TICKETS.pop(ticket, None)
    if item is None:
        return None
    expires, profile = item
    if expires <= _now():
        return None
    return profile


def _frontend_base(settings: Settings, app: str) -> str:
    if app == "admin":
        return settings.sso_admin_frontend_url.rstrip("/")
    if app == "participant":
        return settings.sso_join_frontend_url.rstrip("/")
    return settings.sso_host_frontend_url.rstrip("/")


def _redirect_uri(settings: Settings) -> str:
    return f"{settings.api_public_url.rstrip('/')}/api/v1/auth/sso/oidc/callback"


async def _fetch_discovery(settings: Settings) -> dict[str, Any]:
    issuer = settings.sso_oidc_issuer.rstrip("/")
    cached = _DISCOVERY_CACHE.get(issuer)
    if cached and cached[0] > _now():
        return cached[1]

    if settings.sso_test_mode:
        doc = {
            "authorization_endpoint": f"{issuer}/authorize",
            "token_endpoint": f"{issuer}/token",
            "userinfo_endpoint": f"{issuer}/userinfo",
        }
    else:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{issuer}/.well-known/openid-configuration")
            resp.raise_for_status()
            doc = resp.json()

    _DISCOVERY_CACHE[issuer] = (_now() + dt.timedelta(hours=1), doc)
    return doc


async def build_authorize_redirect_url(*, app: str, return_to: str = "") -> str:
    settings = get_settings()
    if not settings.sso_enabled:
        raise AppError(ErrorCode.FORBIDDEN, "SSO 未啟用")

    discovery = await _fetch_discovery(settings)
    state = secrets.token_urlsafe(32)
    await _store_state(
        state,
        {
            "app": app,
            "return_to": return_to or "",
            "nonce": secrets.token_urlsafe(16),
        },
    )

    params = {
        "response_type": "code",
        "client_id": settings.sso_oidc_client_id,
        "redirect_uri": _redirect_uri(settings),
        "scope": settings.sso_oidc_scopes,
        "state": state,
    }
    auth_endpoint = discovery.get("authorization_endpoint")
    if not auth_endpoint:
        raise AppError(ErrorCode.INTERNAL_ERROR, "OIDC 設定缺少 authorization_endpoint")
    return f"{auth_endpoint}?{urlencode(params)}"


async def _exchange_code(settings: Settings, code: str) -> dict[str, Any]:
    discovery = await _fetch_discovery(settings)
    token_endpoint = discovery.get("token_endpoint")
    if not token_endpoint:
        raise AppError(ErrorCode.INTERNAL_ERROR, "OIDC 設定缺少 token_endpoint")

    if settings.sso_test_mode:
        return {
            "access_token": "test-access",
            "id_token": "test-id",
        }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            token_endpoint,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": _redirect_uri(settings),
                "client_id": settings.sso_oidc_client_id,
                "client_secret": settings.sso_oidc_client_secret,
            },
            headers={"Accept": "application/json"},
        )
        if resp.status_code >= 400:
            logger.warning("OIDC token exchange failed: %s", resp.text[:200])
            raise AppError(ErrorCode.UNAUTHENTICATED, "SSO 登入失敗")
        return resp.json()


async def _fetch_userinfo(
    settings: Settings, token_payload: dict[str, Any]
) -> dict[str, Any]:
    if settings.sso_test_mode:
        email = settings.sso_test_email or "sso-user@example.com"
        return {
            "sub": "test-subject",
            "email": email,
            "name": "SSO Test User",
        }

    discovery = await _fetch_discovery(settings)
    userinfo_endpoint = discovery.get("userinfo_endpoint")
    access_token = token_payload.get("access_token")
    if not userinfo_endpoint or not access_token:
        raise AppError(ErrorCode.UNAUTHENTICATED, "SSO 無法取得使用者資訊")

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code >= 400:
            raise AppError(ErrorCode.UNAUTHENTICATED, "SSO 使用者資訊取得失敗")
        return resp.json()


async def _resolve_user(
    db: AsyncSession,
    *,
    email: str,
    name: str | None,
    settings: Settings,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user is not None:
        if user.sso_provider is None:
            user.sso_provider = "oidc"
        if name and not user.name:
            user.name = name
        return user

    if not settings.sso_auto_provision:
        raise AppError(ErrorCode.FORBIDDEN, "此 Email 尚未被授權使用 SSO")

    org_id: uuid.UUID | None = None
    if settings.sso_default_org_id:
        try:
            org_id = uuid.UUID(settings.sso_default_org_id)
        except ValueError as exc:
            raise AppError(ErrorCode.INTERNAL_ERROR, "SSO 預設組織 ID 無效") from exc
        org_exists = await db.execute(
            select(Organization.id).where(Organization.id == org_id)
        )
        if org_exists.scalar_one_or_none() is None:
            raise AppError(ErrorCode.NOT_FOUND, "SSO 預設組織不存在")
    else:
        org = Organization(name=f"{email.split('@')[-1]} Org", plan="free", settings_jsonb={})
        db.add(org)
        await db.flush()
        org_id = org.id

    user = User(
        id=uuid7(),
        org_id=org_id,
        email=email,
        name=name,
        password_hash=None,
        sso_provider="oidc",
        role=UserRole.HOST,
    )
    db.add(user)
    await db.flush()
    return user


async def complete_oidc_callback(
    db: AsyncSession,
    *,
    code: str,
    state: str,
) -> str:
    """驗證 callback，回傳前端 redirect URL（含一次性 ticket）。"""
    settings = get_settings()
    if not settings.sso_enabled:
        raise AppError(ErrorCode.FORBIDDEN, "SSO 未啟用")

    stored = await _pop_state(state)
    if stored is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "SSO state 無效或已過期")

    token_payload = await _exchange_code(settings, code)
    profile = await _fetch_userinfo(settings, token_payload)
    email = profile.get("email")
    if not email or not isinstance(email, str):
        raise AppError(ErrorCode.UNAUTHENTICATED, "SSO 未回傳 Email")

    app = stored.get("app", "host")

    if app == "participant":
        ticket = secrets.token_urlsafe(32)
        name = profile.get("name") if isinstance(profile.get("name"), str) else None
        await _store_participant_ticket(
            ticket,
            {"email": email.lower().strip(), "name": name or ""},
        )
    else:
        user = await _resolve_user(
            db,
            email=email.lower().strip(),
            name=profile.get("name") if isinstance(profile.get("name"), str) else None,
            settings=settings,
        )
        await db.commit()

        tokens = TokenResponse(
            access_token=create_access_token(
                user_id=user.id, org_id=user.org_id, role=user.role
            ),
            refresh_token=create_refresh_token(user_id=user.id),
        )
        ticket = secrets.token_urlsafe(32)
        await _store_ticket(ticket, tokens)

    base = _frontend_base(settings, app)
    return_to = stored.get("return_to") or ""
    url = f"{base}/#/sso/callback?ticket={quote(ticket, safe='')}"
    if return_to:
        url += f"&return_to={quote(return_to, safe='')}"
    return url


async def exchange_ticket(ticket: str) -> TokenResponse:
    tokens = await _pop_ticket(ticket)
    if tokens is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "SSO ticket 無效或已過期")
    return tokens


async def exchange_participant_ticket(ticket: str) -> SsoParticipantProfile:
    profile = await _pop_participant_ticket(ticket)
    if profile is None:
        raise AppError(ErrorCode.UNAUTHENTICATED, "SSO ticket 無效或已過期")
    return SsoParticipantProfile(
        email=profile["email"],
        name=profile.get("name") or None,
    )
