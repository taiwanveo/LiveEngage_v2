"""管理後台業務邏輯（BE-008/009/010）。

BE-008：組織資料讀取 / 更新、成員列表 / 邀請 / 角色更新 / 移除。
BE-009：組織活動列表、封存。
BE-010：稽核紀錄查詢（帶 actor email join）。

鐵律 8：所有端點由 `require_role(UserRole.ADMIN)` 強制伺服端授權。
鐵律 10：組織設定與成員變更均寫 audit log。
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import func, outerjoin, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.security import hash_secret
from app.models.audit_log import AuditLog
from app.models.enums import SessionStatus, UserRole
from app.models.export_job import ExportJob
from app.models.interaction import Interaction
from app.models.organization import Organization
from app.models.participant import Participant
from app.models.poll import PollResponse as PollResponseRow
from app.models.question import Question
from app.models.room import Room
from app.models.session import Session
from app.models.sprint9 import AiRequestLog
from app.models.user import User
from app.schemas.admin import (
    AdminSessionListResponse,
    AdminSessionPatchRequest,
    AdminSessionResponse,
    AuditLogListResponse,
    AuditLogResponse,
    BrandingResponse,
    BrandingSettings,
    BrandingUpdateRequest,
    MemberInviteRequest,
    MemberResponse,
    MemberUpdateRequest,
    OrgResponse,
    OrgUpdateRequest,
    PublicBrandingResponse,
)
from app.schemas.admin_stats import (
    AdminStatsOverview,
    AiRequestLogItem,
    AiRequestLogListResponse,
    EngagementAnalytics,
)
from app.services import audit_service

# ── helpers ──────────────────────────────────────────────────────────────────


def _to_org_response(org: Organization) -> OrgResponse:
    return OrgResponse(
        id=org.id,
        name=org.name,
        plan=org.plan,
        settings_jsonb=org.settings_jsonb or {},
        created_at=org.created_at,
        updated_at=org.updated_at,
    )


def _to_member_response(user: User) -> MemberResponse:
    return MemberResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        created_at=user.created_at,
    )


def _to_session_response(session: Session) -> AdminSessionResponse:
    return AdminSessionResponse(
        id=session.id,
        org_id=session.org_id,
        host_user_id=session.host_user_id,
        title=session.title,
        code=session.code,
        status=session.status,
        visibility=session.visibility,
        created_at=session.created_at,
        updated_at=session.updated_at,
        archived_at=session.archived_at,
    )


async def _get_org_or_403(db: AsyncSession, actor: User) -> Organization:
    result = await db.execute(select(Organization).where(Organization.id == actor.org_id))
    org = result.scalar_one_or_none()
    if org is None:
        raise AppError(ErrorCode.FORBIDDEN, "組織不存在")
    return org


# ── BE-008: Organization ─────────────────────────────────────────────────────


async def get_organization(db: AsyncSession, actor: User) -> OrgResponse:
    org = await _get_org_or_403(db, actor)
    return _to_org_response(org)


async def update_organization(
    db: AsyncSession,
    *,
    actor: User,
    payload: OrgUpdateRequest,
) -> OrgResponse:
    """更新組織資料（鐵律 10：寫 audit log）。"""
    org = await _get_org_or_403(db, actor)

    changed: dict[str, Any] = {}
    if payload.name is not None and payload.name != org.name:
        changed["name"] = {"from": org.name, "to": payload.name}
        org.name = payload.name
    if payload.plan is not None and payload.plan != org.plan:
        changed["plan"] = {"from": org.plan, "to": payload.plan}
        org.plan = payload.plan
    if payload.settings_jsonb is not None:
        changed["settings_jsonb"] = True
        org.settings_jsonb = payload.settings_jsonb

    if changed:
        await audit_service.log(
            db,
            actor=actor,
            action="update_organization",
            target_type="organization",
            target_id=org.id,
            details={"changes": changed},
        )
        await db.commit()
        await db.refresh(org)
    return _to_org_response(org)


# ── BE-008: Members ───────────────────────────────────────────────────────────


async def list_members(db: AsyncSession, actor: User) -> list[MemberResponse]:
    result = await db.execute(
        select(User).where(User.org_id == actor.org_id).order_by(User.created_at.asc())
    )
    users = result.scalars().all()
    return [_to_member_response(u) for u in users]


async def invite_member(
    db: AsyncSession,
    *,
    actor: User,
    payload: MemberInviteRequest,
) -> MemberResponse:
    """邀請（建立）新成員（BE-008）。"""
    if payload.role == UserRole.GUEST:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "訪客帳號已停用；參與者請使用活動 QR Code 加入",
        )
    exists = await db.execute(select(User).where(User.email == str(payload.email)))
    if exists.scalar_one_or_none() is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此 Email 已存在")

    invite_role = UserRole.HOST if payload.role == UserRole.MEMBER else payload.role
    new_user = User(
        id=uuid7(),
        org_id=actor.org_id,
        email=str(payload.email),
        name=payload.name,
        password_hash=hash_secret(payload.password),
        role=invite_role,
    )
    db.add(new_user)
    await audit_service.log(
        db,
        actor=actor,
        action="invite_member",
        target_type="user",
        target_id=new_user.id,
        details={"email": str(payload.email), "role": invite_role.value},
    )
    await db.commit()
    await db.refresh(new_user)
    return _to_member_response(new_user)


async def update_member(
    db: AsyncSession,
    *,
    actor: User,
    user_id: uuid.UUID,
    payload: MemberUpdateRequest,
) -> MemberResponse:
    """更新成員姓名、密碼或角色（不可降低 owner 等級）。"""
    if payload.role is None and payload.name is None and payload.password is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "請至少提供一項要更新的欄位")

    result = await db.execute(select(User).where(User.id == user_id, User.org_id == actor.org_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到成員")

    changes: dict[str, Any] = {}

    if payload.name is not None and payload.name != target.name:
        changes["name"] = {"from": target.name, "to": payload.name}
        target.name = payload.name

    if payload.password is not None:
        target.password_hash = hash_secret(payload.password)
        changes["password"] = True

    if payload.role is not None:
        if target.role == UserRole.OWNER and payload.role != UserRole.OWNER:
            raise AppError(ErrorCode.FORBIDDEN, "不可變更 Owner 角色")
        if payload.role == UserRole.GUEST:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                "訪客帳號已停用；參與者請使用活動 QR Code 加入",
            )
        new_role = UserRole.HOST if payload.role == UserRole.MEMBER else payload.role
        if new_role != target.role:
            changes["role"] = {"from": target.role.value, "to": new_role.value}
            target.role = new_role

    if not changes:
        return _to_member_response(target)

    await audit_service.log(
        db,
        actor=actor,
        action="update_member",
        target_type="user",
        target_id=target.id,
        details={"email": target.email, "changes": changes},
    )
    await db.commit()
    await db.refresh(target)
    return _to_member_response(target)


async def remove_member(
    db: AsyncSession,
    *,
    actor: User,
    user_id: uuid.UUID,
) -> None:
    """移除成員（不可移除 owner）。"""
    if actor.id == user_id:
        raise AppError(ErrorCode.FORBIDDEN, "不可移除自己")
    result = await db.execute(select(User).where(User.id == user_id, User.org_id == actor.org_id))
    target = result.scalar_one_or_none()
    if target is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到成員")
    if target.role == UserRole.OWNER:
        raise AppError(ErrorCode.FORBIDDEN, "不可移除 Owner")

    await audit_service.log(
        db,
        actor=actor,
        action="remove_member",
        target_type="user",
        target_id=target.id,
        details={"email": target.email},
    )
    await db.delete(target)
    await db.commit()


# ── BE-009: Sessions ──────────────────────────────────────────────────────────


async def list_sessions(
    db: AsyncSession,
    *,
    actor: User,
    status: SessionStatus | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> AdminSessionListResponse:
    """列出組織所有活動（支援狀態篩選與標題/代碼搜尋）。"""
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size

    base = select(Session).where(Session.org_id == actor.org_id)
    if status is not None:
        base = base.where(Session.status == status)
    if search:
        term = f"%{search.lower()}%"
        base = base.where(
            func.lower(Session.title).like(term) | func.lower(Session.code).like(term)
        )

    count_q = select(func.count()).select_from(base.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    rows = await db.execute(
        base.order_by(Session.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [_to_session_response(s) for s in rows.scalars().all()]
    return AdminSessionListResponse(items=items, total=total, page=page, page_size=page_size)


async def patch_session(
    db: AsyncSession,
    *,
    actor: User,
    session_id: uuid.UUID,
    payload: AdminSessionPatchRequest,
) -> AdminSessionResponse:
    """封存或更新活動狀態（BE-009）。"""
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.org_id == actor.org_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到活動")

    old_status = session.status
    if payload.status is not None:
        session.status = payload.status
        if payload.status == SessionStatus.ARCHIVED:
            # archived_at 欄位為 TIMESTAMP WITHOUT TIME ZONE，需傳 naive datetime
            session.archived_at = dt.datetime.utcnow()
        await audit_service.log(
            db,
            actor=actor,
            action="admin_update_session_status",
            target_type="session",
            target_id=session.id,
            session_id=session.id,
            details={"from": old_status.value, "to": payload.status.value},
        )

    await db.commit()
    await db.refresh(session)
    if (
        payload.status == SessionStatus.LIVE
        and old_status != SessionStatus.LIVE
    ):
        from app.services.session_service import broadcast_session_started

        await broadcast_session_started(db, session)
    if (
        payload.status == SessionStatus.ENDED
        and old_status != SessionStatus.ENDED
    ):
        from app.services.session_service import broadcast_session_ended

        await broadcast_session_ended(db, session)
    return _to_session_response(session)


# ── BE-010: Audit Logs ────────────────────────────────────────────────────────


async def list_audit_logs(
    db: AsyncSession,
    *,
    actor: User,
    action_filter: str | None = None,
    actor_user_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    target_type: str | None = None,
    date_from: dt.datetime | None = None,
    date_to: dt.datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> AuditLogListResponse:
    """查詢稽核紀錄（BE-010）。帶 actor email join。"""
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size

    # alias for actor User join
    ActorUser = User.__table__.alias("actor_user")

    base = (
        select(
            AuditLog,
            ActorUser.c.email.label("actor_email"),
        )
        .select_from(
            outerjoin(
                AuditLog.__table__,
                ActorUser,
                AuditLog.actor_user_id == ActorUser.c.id,
            )
        )
        .where(AuditLog.org_id == actor.org_id)
    )

    if action_filter:
        base = base.where(AuditLog.action == action_filter)
    if actor_user_id:
        base = base.where(AuditLog.actor_user_id == actor_user_id)
    if session_id:
        base = base.where(AuditLog.session_id == session_id)
    if target_type:
        base = base.where(AuditLog.target_type == target_type)
    if date_from:
        base = base.where(AuditLog.created_at >= date_from)
    if date_to:
        base = base.where(AuditLog.created_at <= date_to)

    count_q = select(func.count()).select_from(base.with_only_columns(AuditLog.id).subquery())
    total = (await db.execute(count_q)).scalar_one()

    rows = await db.execute(
        base.order_by(AuditLog.created_at.desc()).offset(offset).limit(page_size)
    )

    items: list[AuditLogResponse] = []
    for row in rows:
        log = row[0]
        actor_email = row[1]
        items.append(
            AuditLogResponse(
                id=log.id,
                org_id=log.org_id,
                actor_user_id=log.actor_user_id,
                actor_email=actor_email,
                session_id=log.session_id,
                room_id=log.room_id,
                target_type=log.target_type,
                target_id=log.target_id,
                action=log.action,
                details_jsonb=log.details_jsonb or {},
                created_at=log.created_at,
            )
        )
    return AuditLogListResponse(items=items, total=total, page=page, page_size=page_size)


# ── S7-4: Branding ───────────────────────────────────────────────────────────

_BRANDING_KEY = "branding"


def _parse_branding(raw: dict[str, Any]) -> BrandingSettings:
    branding_raw = raw.get(_BRANDING_KEY) if isinstance(raw, dict) else {}
    if not isinstance(branding_raw, dict):
        branding_raw = {}
    return BrandingSettings.model_validate(branding_raw)


async def get_branding(db: AsyncSession, actor: User) -> BrandingResponse:
    org = await _get_org_or_403(db, actor)
    return BrandingResponse(org_id=org.id, branding=_parse_branding(org.settings_jsonb or {}))


async def get_branding_for_user(db: AsyncSession, actor: User) -> PublicBrandingResponse:
    """已登入 Host／Admin 使用者讀取自身組織品牌。"""
    org = await _get_org_or_403(db, actor)
    branding = _parse_branding(org.settings_jsonb or {})
    return PublicBrandingResponse(
        display_name=branding.display_name or org.name,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
    )


async def update_branding(
    db: AsyncSession,
    *,
    actor: User,
    payload: BrandingUpdateRequest,
) -> BrandingResponse:
    org = await _get_org_or_403(db, actor)
    current = _parse_branding(org.settings_jsonb or {})
    updates = payload.model_dump(exclude_unset=True)
    merged = current.model_copy(update=updates)
    settings = dict(org.settings_jsonb or {})
    settings[_BRANDING_KEY] = merged.model_dump()
    org.settings_jsonb = settings
    await audit_service.log(
        db,
        actor=actor,
        action="update_branding",
        target_type="organization",
        target_id=org.id,
        details={"fields": list(updates.keys())},
    )
    await db.commit()
    await db.refresh(org)
    return BrandingResponse(org_id=org.id, branding=merged)


async def get_public_branding_by_code(
    db: AsyncSession, code: str, *, client_ip: str | None = None
) -> PublicBrandingResponse:
    """依活動代碼回傳公開品牌（參與者 / Host 端）。"""
    normalized = code.strip().lower()
    result = await db.execute(
        select(Session, Organization)
        .join(Organization, Session.org_id == Organization.id)
        .where(func.lower(Session.code) == normalized)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    session, org = row
    if client_ip:
        from app.schemas.rate_limit import parse_rate_limits
        from app.services.rate_limit_service import check_by_code_lookup

        await check_by_code_lookup(client_ip, parse_rate_limits(org.settings_jsonb))
    branding = _parse_branding(org.settings_jsonb or {})
    return PublicBrandingResponse(
        display_name=branding.display_name or org.name,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
    )


async def _resolve_site_organization(db: AsyncSession) -> Organization | None:
    """部署站點的預設組織（Admin 登入頁品牌）。"""
    settings = get_settings()
    if settings.sso_default_org_id:
        try:
            org_id = uuid.UUID(settings.sso_default_org_id)
        except ValueError:
            org_id = None
        if org_id is not None:
            org = await db.get(Organization, org_id)
            if org is not None:
                return org
    result = await db.execute(
        select(Organization).order_by(Organization.created_at.asc()).limit(1)
    )
    return result.scalar_one_or_none()


async def get_site_branding(db: AsyncSession) -> PublicBrandingResponse:
    """公開站點品牌（Admin 登入頁，無需認證）。"""
    org = await _resolve_site_organization(db)
    if org is None:
        return PublicBrandingResponse(
            display_name=None,
            logo_url=None,
            favicon_url=None,
            primary_color="#2563eb",
        )
    branding = _parse_branding(org.settings_jsonb or {})
    return PublicBrandingResponse(
        display_name=branding.display_name or org.name or None,
        logo_url=branding.logo_url,
        favicon_url=branding.favicon_url,
        primary_color=branding.primary_color,
    )


# ── Analytics / Stats ─────────────────────────────────────────────────────────


async def get_stats_overview(db: AsyncSession, actor: User) -> AdminStatsOverview:
    org_id = actor.org_id
    sessions_total = (
        await db.execute(select(func.count()).select_from(Session).where(Session.org_id == org_id))
    ).scalar_one()
    sessions_live = (
        await db.execute(
            select(func.count())
            .select_from(Session)
            .where(Session.org_id == org_id, Session.status == SessionStatus.LIVE)
        )
    ).scalar_one()
    participants_total = (
        await db.execute(
            select(func.count())
            .select_from(Participant)
            .join(Session, Participant.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    poll_responses_total = (
        await db.execute(
            select(func.count())
            .select_from(PollResponseRow)
            .join(Interaction, PollResponseRow.interaction_id == Interaction.id)
            .join(Room, Interaction.room_id == Room.id)
            .join(Session, Room.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    export_jobs_total = (
        await db.execute(
            select(func.count()).select_from(ExportJob).where(ExportJob.org_id == org_id)
        )
    ).scalar_one()
    ai_requests_total = (
        await db.execute(
            select(func.count()).select_from(AiRequestLog).where(AiRequestLog.org_id == org_id)
        )
    ).scalar_one()
    return AdminStatsOverview(
        sessions_total=sessions_total,
        sessions_live=sessions_live,
        participants_total=participants_total,
        poll_responses_total=poll_responses_total,
        export_jobs_total=export_jobs_total,
        ai_requests_total=ai_requests_total,
    )


async def get_engagement_analytics(db: AsyncSession, actor: User) -> EngagementAnalytics:
    org_id = actor.org_id
    participants_total = (
        await db.execute(
            select(func.count())
            .select_from(Participant)
            .join(Session, Participant.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    participants_qa = (
        await db.execute(
            select(func.count(func.distinct(Question.participant_id)))
            .select_from(Question)
            .join(Session, Question.session_id == Session.id)
            .where(Session.org_id == org_id, Question.participant_id.is_not(None))
        )
    ).scalar_one()
    participants_poll_voters = (
        await db.execute(
            select(func.count(func.distinct(PollResponseRow.participant_id)))
            .select_from(PollResponseRow)
            .join(Participant, PollResponseRow.participant_id == Participant.id)
            .join(Session, Participant.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    qa_participant_ids = (
        select(Question.participant_id.label("participant_id"))
        .select_from(Question)
        .join(Session, Question.session_id == Session.id)
        .where(Session.org_id == org_id, Question.participant_id.is_not(None))
    )
    poll_participant_ids = (
        select(PollResponseRow.participant_id.label("participant_id"))
        .select_from(PollResponseRow)
        .join(Participant, PollResponseRow.participant_id == Participant.id)
        .join(Session, Participant.session_id == Session.id)
        .where(Session.org_id == org_id)
    )
    engaged_ids = union(qa_participant_ids, poll_participant_ids).subquery()
    participants_engaged = (
        await db.execute(select(func.count()).select_from(engaged_ids))
    ).scalar_one()
    poll_votes_total = (
        await db.execute(
            select(func.count())
            .select_from(PollResponseRow)
            .join(Interaction, PollResponseRow.interaction_id == Interaction.id)
            .join(Room, Interaction.room_id == Room.id)
            .join(Session, Room.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    qa_questions_total = (
        await db.execute(
            select(func.count())
            .select_from(Question)
            .join(Session, Question.session_id == Session.id)
            .where(Session.org_id == org_id)
        )
    ).scalar_one()
    engaged = min(participants_engaged, participants_total)
    score = int(round(engaged / participants_total * 100)) if participants_total else 0
    return EngagementAnalytics(
        participants_total=participants_total,
        participants_qa=participants_qa,
        participants_poll_voters=participants_poll_voters,
        participants_engaged=participants_engaged,
        engaged_score_percent=min(score, 100),
        poll_votes_total=poll_votes_total,
        qa_questions_total=qa_questions_total,
    )


async def list_ai_request_logs(
    db: AsyncSession,
    actor: User,
    *,
    page: int = 1,
    page_size: int = 20,
) -> AiRequestLogListResponse:
    page_size = min(page_size, 100)
    offset = (page - 1) * page_size
    base = select(AiRequestLog).where(AiRequestLog.org_id == actor.org_id)
    total = (
        await db.execute(
            select(func.count())
            .select_from(AiRequestLog)
            .where(AiRequestLog.org_id == actor.org_id)
        )
    ).scalar_one()
    rows = await db.execute(
        base.order_by(AiRequestLog.created_at.desc()).offset(offset).limit(page_size)
    )
    items = [
        AiRequestLogItem(
            id=log.id,
            feature=log.feature,
            status=log.status,
            latency_ms=log.latency_ms,
            created_at=log.created_at,
        )
        for log in rows.scalars().all()
    ]
    return AiRequestLogListResponse(
        items=items, total=total, page=page, page_size=page_size
    )
