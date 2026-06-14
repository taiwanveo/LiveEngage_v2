"""Session 與 Join 業務邏輯（FE-001/002、BE-001）。"""

from __future__ import annotations

import datetime as dt
import re
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.security import hash_secret, verify_secret
from app.core.tokens import create_participant_token
from app.models.enums import AuthMethod, SessionStatus, SessionVisibility, UserRole
from app.models.organization import Organization
from app.models.participant import Participant
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.session import (
    JoinRequest,
    JoinResponse,
    SessionCreateRequest,
    SessionHostResponse,
    SessionPublicResponse,
    SessionSettings,
    SessionUpdateRequest,
)
from app.schemas.rate_limit import parse_rate_limits
from app.serializers.mask_identity import mask_identity
from app.services.rate_limit_service import check_by_code_lookup, check_passcode_attempt
from app.utils.session_code import generate_session_code

_EMAIL_DOMAIN_RE = re.compile(r"^[^@]+@([^@]+)$")


def _parse_settings(raw: dict[str, Any]) -> SessionSettings:
    return SessionSettings.model_validate(raw or {})


def _settings_to_dict(settings: SessionSettings) -> dict[str, Any]:
    return settings.model_dump()


async def _get_session_or_404(db: AsyncSession, session_id: uuid.UUID) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    return session


async def _get_session_by_code(db: AsyncSession, code: str) -> Session | None:
    normalized = code.strip().lower()
    result = await db.execute(
        select(Session).where(func.lower(Session.code) == normalized)
    )
    return result.scalar_one_or_none()


async def _get_default_room(db: AsyncSession, session_id: uuid.UUID) -> Room:
    result = await db.execute(
        select(Room)
        .where(Room.session_id == session_id)
        .order_by(Room.order_no.asc())
        .limit(1)
    )
    room = result.scalar_one_or_none()
    if room is None:
        raise AppError(ErrorCode.NOT_FOUND, "活動尚未建立房間")
    return room


async def create_session(
    db: AsyncSession,
    *,
    host: User,
    payload: SessionCreateRequest,
) -> SessionHostResponse:
    """建立活動並自動建立預設 Room（BE-001）。"""
    settings = payload.settings
    passcode_hash = hash_secret(payload.passcode) if payload.passcode else None

    for _ in range(5):
        code = generate_session_code()
        session = Session(
            id=uuid7(),
            org_id=host.org_id,
            host_user_id=host.id,
            title=payload.title,
            code=code,
            description=payload.description,
            timezone=payload.timezone,
            language=payload.language,
            status=SessionStatus.DRAFT,
            visibility=payload.visibility,
            passcode_hash=passcode_hash,
            settings_jsonb=_settings_to_dict(settings),
        )
        db.add(session)
        await db.flush()
        db.add(
            Room(
                id=uuid7(),
                session_id=session.id,
                name="Main",
                slug="main",
                order_no=0,
            )
        )
        try:
            await db.commit()
        except IntegrityError:
            await db.rollback()
            continue
        await db.refresh(session)
        return await _to_host_response(db, session)

    raise AppError(ErrorCode.INTERNAL, "無法產生活動代碼，請重試")


async def broadcast_session_ended(db: AsyncSession, session: Session) -> None:
    """活動結束時廣播至所有房間連線（參與者即時通知）。"""
    result = await db.execute(
        select(Room.id).where(Room.session_id == session.id)
    )
    payload = {
        "session_id": str(session.id),
        "title": session.title,
        "status": SessionStatus.ENDED.value,
    }
    for (room_id,) in result.all():
        await events.publish(
            room_id,
            events.SESSION_ENDED,
            payload,
            target_modes=events.MODE_ALL,
        )


async def broadcast_session_started(db: AsyncSession, session: Session) -> None:
    """活動開始（live）時廣播至所有房間連線。"""
    result = await db.execute(
        select(Room.id).where(Room.session_id == session.id)
    )
    payload = {
        "session_id": str(session.id),
        "title": session.title,
        "status": SessionStatus.LIVE.value,
    }
    for (room_id,) in result.all():
        await events.publish(
            room_id,
            events.SESSION_STARTED,
            payload,
            target_modes=events.MODE_ALL,
        )


async def update_session(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User,
    payload: SessionUpdateRequest,
) -> SessionHostResponse:
    """更新活動（需為 host 或同 org admin）。"""
    session = await _get_session_or_404(db, session_id)
    if session.host_user_id != host.id and host.org_id != session.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權限編輯此活動")

    old_status = session.status
    if payload.title is not None:
        session.title = payload.title
    if payload.description is not None:
        session.description = payload.description
    if payload.status is not None:
        session.status = payload.status
        if payload.status == SessionStatus.ARCHIVED:
            session.archived_at = dt.datetime.now(dt.UTC).replace(tzinfo=None)
    if payload.visibility is not None:
        session.visibility = payload.visibility
    if payload.passcode is not None:
        session.passcode_hash = hash_secret(payload.passcode)
    if payload.settings is not None:
        session.settings_jsonb = _settings_to_dict(payload.settings)

    await db.commit()
    await db.refresh(session)
    if (
        payload.status == SessionStatus.LIVE
        and old_status != SessionStatus.LIVE
    ):
        await broadcast_session_started(db, session)
    if (
        payload.status == SessionStatus.ENDED
        and old_status != SessionStatus.ENDED
    ):
        await broadcast_session_ended(db, session)
    return await _to_host_response(db, session)


async def list_host_sessions(
    db: AsyncSession,
    *,
    host: User,
) -> list[SessionHostResponse]:
    """主持人自己的活動列表（依建立時間新到舊；不含已封存）。"""
    result = await db.execute(
        select(Session)
        .where(
            Session.host_user_id == host.id,
            Session.status != SessionStatus.ARCHIVED,
        )
        .order_by(Session.created_at.desc())
    )
    sessions = result.scalars().all()
    out: list[SessionHostResponse] = []
    for session in sessions:
        out.append(await _to_host_response(db, session))
    return out


async def get_host_session(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User,
) -> SessionHostResponse:
    """取得單一活動（需為主持人）。"""
    session = await _get_session_or_404(db, session_id)
    if session.host_user_id != host.id:
        raise AppError(ErrorCode.FORBIDDEN, "無權限檢視此活動")
    return await _to_host_response(db, session)


async def _org_rate_limits(db: AsyncSession, org_id: uuid.UUID):
    result = await db.execute(
        select(Organization.settings_jsonb).where(Organization.id == org_id)
    )
    raw = result.scalar_one_or_none()
    return parse_rate_limits(raw if isinstance(raw, dict) else None)


async def resolve_session_by_code(
    db: AsyncSession, code: str, *, client_ip: str | None = None
) -> SessionPublicResponse:
    """解析活動代碼（FE-001-FR1）。"""
    session = await _get_session_by_code(db, code)
    if session is None:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    if client_ip:
        limits = await _org_rate_limits(db, session.org_id)
        await check_by_code_lookup(client_ip, limits)
    settings = _parse_settings(session.settings_jsonb)
    return SessionPublicResponse(
        id=session.id,
        title=session.title,
        code=session.code,
        status=session.status,
        visibility=session.visibility,
        require_name=settings.require_name,
        require_email=settings.require_email,
        language=session.language,
    )


async def join_session(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    payload: JoinRequest,
    client_ip: str | None = None,
) -> JoinResponse:
    """參與者加入活動（FE-001/002）。"""
    session = await _get_session_or_404(db, session_id)
    settings = _parse_settings(session.settings_jsonb)

    if session.status == SessionStatus.ENDED:
        raise AppError(ErrorCode.SESSION_ENDED, "活動已結束")
    if session.status == SessionStatus.ARCHIVED:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    if session.status != SessionStatus.LIVE:
        raise AppError(ErrorCode.SESSION_NOT_LIVE, "活動尚未開放")

    if session.visibility == SessionVisibility.SSO:
        raise AppError(ErrorCode.FORBIDDEN, "此活動需 SSO 登入")
    if session.visibility == SessionVisibility.RESTRICTED:
        raise AppError(ErrorCode.FORBIDDEN, "此活動限制加入")

    if session.visibility == SessionVisibility.PASSCODE:
        if client_ip:
            limits = await _org_rate_limits(db, session.org_id)
            await check_passcode_attempt(client_ip, limits)
        if not payload.passcode:
            raise AppError(ErrorCode.PASSCODE_INVALID, "請輸入 Passcode")
        if not session.passcode_hash or not verify_secret(
            session.passcode_hash, payload.passcode
        ):
            raise AppError(ErrorCode.PASSCODE_INVALID, "Passcode 錯誤")

    if settings.require_name and not payload.name:
        raise AppError(ErrorCode.VALIDATION_ERROR, "請填寫姓名", details={"field": "name"})
    if settings.require_email and not payload.email:
        raise AppError(ErrorCode.VALIDATION_ERROR, "請填寫 Email", details={"field": "email"})

    if payload.email and settings.allowed_email_domains:
        match = _EMAIL_DOMAIN_RE.match(str(payload.email))
        domain = match.group(1).lower() if match else ""
        allowed = {d.lower() for d in settings.allowed_email_domains}
        if domain not in allowed:
            raise AppError(ErrorCode.EMAIL_DOMAIN_RESTRICTED, "Email 網域不符合限制")

    if payload.is_anonymous and settings.anonymity_mode == "force_named":
        raise AppError(ErrorCode.ANON_NOT_ALLOWED, "此活動不允許匿名")

    room: Room
    if payload.room_id:
        result = await db.execute(
            select(Room).where(Room.id == payload.room_id, Room.session_id == session.id)
        )
        found = result.scalar_one_or_none()
        if found is None:
            raise AppError(ErrorCode.NOT_FOUND, "找不到房間")
        room = found
    else:
        room = await _get_default_room(db, session.id)

    auth_method = AuthMethod.NONE
    if session.visibility == SessionVisibility.PASSCODE:
        auth_method = AuthMethod.PASSCODE
    elif payload.email:
        auth_method = AuthMethod.EMAIL

    now = dt.datetime.now(dt.UTC)
    participant = Participant(
        id=uuid7(),
        session_id=session.id,
        room_id=room.id,
        display_name=payload.name,
        email=str(payload.email) if payload.email else None,
        is_anonymous=payload.is_anonymous,
        auth_method=auth_method,
        joined_at=now,
        last_seen_at=now,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    anon_allowed = settings.anonymity_mode != "force_named"
    token = create_participant_token(
        participant_id=participant.id,
        session_id=session.id,
        room_id=room.id,
        anon_allowed=anon_allowed,
        session_end_at=session.end_at,
    )

    output = mask_identity(
        {
            "participant_id": participant.id,
            "display_name": participant.display_name,
            "email": participant.email,
            "is_anonymous": participant.is_anonymous,
        }
    )
    return JoinResponse(
        participant_token=token,
        session_id=session.id,
        room_id=room.id,
        participant_id=participant.id,
        display_name=output.get("display_name"),
        email=output.get("email"),
        is_anonymous=participant.is_anonymous,
    )


async def join_with_sso(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    email: str,
    name: str | None,
    room_id: uuid.UUID | None = None,
) -> JoinResponse:
    """Participant SSO 加入（visibility=sso）。"""
    session = await _get_session_or_404(db, session_id)
    settings = _parse_settings(session.settings_jsonb)

    if session.visibility != SessionVisibility.SSO:
        raise AppError(ErrorCode.FORBIDDEN, "此活動不需 SSO 登入")
    if session.status == SessionStatus.ENDED:
        raise AppError(ErrorCode.SESSION_ENDED, "活動已結束")
    if session.status == SessionStatus.ARCHIVED:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    if session.status != SessionStatus.LIVE:
        raise AppError(ErrorCode.SESSION_NOT_LIVE, "活動尚未開放")

    if settings.allowed_email_domains:
        match = _EMAIL_DOMAIN_RE.match(email)
        domain = match.group(1).lower() if match else ""
        allowed = {d.lower() for d in settings.allowed_email_domains}
        if domain not in allowed:
            raise AppError(ErrorCode.EMAIL_DOMAIN_RESTRICTED, "Email 網域不符合限制")

    room: Room
    if room_id:
        result = await db.execute(
            select(Room).where(Room.id == room_id, Room.session_id == session.id)
        )
        found = result.scalar_one_or_none()
        if found is None:
            raise AppError(ErrorCode.NOT_FOUND, "找不到房間")
        room = found
    else:
        room = await _get_default_room(db, session.id)

    now = dt.datetime.now(dt.UTC)
    participant = Participant(
        id=uuid7(),
        session_id=session.id,
        room_id=room.id,
        display_name=name or email.split("@")[0],
        email=email,
        is_anonymous=False,
        auth_method=AuthMethod.SSO,
        joined_at=now,
        last_seen_at=now,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    anon_allowed = settings.anonymity_mode != "force_named"
    token = create_participant_token(
        participant_id=participant.id,
        session_id=session.id,
        room_id=room.id,
        anon_allowed=anon_allowed,
        session_end_at=session.end_at,
    )
    output = mask_identity(
        {
            "participant_id": participant.id,
            "display_name": participant.display_name,
            "email": participant.email,
            "is_anonymous": participant.is_anonymous,
        }
    )
    return JoinResponse(
        participant_token=token,
        session_id=session.id,
        room_id=room.id,
        participant_id=participant.id,
        display_name=output.get("display_name"),
        email=output.get("email"),
        is_anonymous=participant.is_anonymous,
    )


async def ensure_host_seed(
    db: AsyncSession,
    *,
    email: str,
    password: str,
    org_name: str = "Demo Org",
) -> User:
    """測試 / 開發用：建立 org + host user（若不存在）。"""
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        return existing

    org = Organization(id=uuid7(), name=org_name, plan="free", settings_jsonb={})
    user = User(
        id=uuid7(),
        org_id=org.id,
        email=email,
        name="Host",
        password_hash=hash_secret(password),
        role=UserRole.OWNER,
    )
    db.add(org)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _to_host_response(
    db: AsyncSession, session: Session
) -> SessionHostResponse:
    room_id: uuid.UUID | None = None
    try:
        room = await _get_default_room(db, session.id)
        room_id = room.id
    except AppError:
        room_id = None
    return SessionHostResponse(
        id=session.id,
        org_id=session.org_id,
        title=session.title,
        code=session.code,
        status=session.status,
        visibility=session.visibility,
        settings=_parse_settings(session.settings_jsonb),
        default_room_id=room_id,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )
