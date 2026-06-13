"""Co-host 業務邏輯（BE-012）。"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import CohostStatus
from app.models.session import Session
from app.models.sprint9 import Cohost
from app.models.user import User
from app.schemas.cohost import (
    CohostInviteRequest,
    CohostListResponse,
    CohostPermissionsUpdateRequest,
    CohostPublic,
)
from app.services import audit_service

DEFAULT_PERMISSIONS: dict[str, bool] = {
    "control_interactions": True,
    "moderate_qa": True,
    "view_results": True,
    "manage_exports": False,
    "edit_content": False,
}


def _merge_permissions(custom: dict[str, bool] | None) -> dict[str, bool]:
    merged = dict(DEFAULT_PERMISSIONS)
    if custom:
        merged.update(custom)
    return merged


def _to_public(row: Cohost) -> CohostPublic:
    perms = {k: bool(v) for k, v in (row.permissions_jsonb or {}).items()}
    return CohostPublic(
        id=row.id,
        session_id=row.session_id,
        user_id=row.user_id,
        email=row.email,
        status=row.status,
        is_external=row.is_external,
        permissions=perms,
        invited_by=row.invited_by,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _load_session_for_host(
    db: AsyncSession, session_id: uuid.UUID, host: User
) -> Session:
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")
    if session.host_user_id != host.id and session.org_id != host.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權操作此活動")
    return session


async def check_session_access(
    db: AsyncSession, user: User, session_id: uuid.UUID
) -> bool:
    """是否為 host 或已接受的 co-host。"""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        return False
    if session.host_user_id == user.id:
        return True
    cohost = await db.execute(
        select(Cohost).where(
            Cohost.session_id == session_id,
            Cohost.user_id == user.id,
            Cohost.status == CohostStatus.ACCEPTED,
        )
    )
    return cohost.scalar_one_or_none() is not None


async def invite(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User,
    payload: CohostInviteRequest,
) -> CohostPublic:
    """邀請 co-host。"""
    session = await _load_session_for_host(db, session_id, host)
    email = payload.email.strip().lower()

    existing = await db.execute(
        select(Cohost).where(
            Cohost.session_id == session_id,
            Cohost.email == email,
            Cohost.status != CohostStatus.REVOKED,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此 email 已有進行中的 co-host 邀請")

    user_match = await db.execute(
        select(User).where(User.email == email, User.org_id == session.org_id)
    )
    matched_user = user_match.scalar_one_or_none()

    row = Cohost(
        id=uuid7(),
        session_id=session_id,
        user_id=matched_user.id if matched_user else None,
        email=email,
        status=CohostStatus.ACCEPTED if matched_user else CohostStatus.PENDING,
        is_external=payload.is_external,
        permissions_jsonb=_merge_permissions(payload.permissions),
        invited_by=host.id,
    )
    db.add(row)
    await audit_service.log(
        db,
        actor=host,
        action="cohost.invite",
        target_type="cohost",
        target_id=row.id,
        session_id=session_id,
        details={"email": email},
    )
    await db.commit()
    await db.refresh(row)
    return _to_public(row)


async def list_cohosts(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User,
) -> CohostListResponse:
    """列出 co-host。"""
    await _load_session_for_host(db, session_id, host)
    result = await db.execute(
        select(Cohost)
        .where(
            Cohost.session_id == session_id,
            Cohost.status != CohostStatus.REVOKED,
        )
        .order_by(Cohost.created_at)
    )
    return CohostListResponse(items=[_to_public(r) for r in result.scalars().all()])


async def update_permissions(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    cohost_id: uuid.UUID,
    host: User,
    payload: CohostPermissionsUpdateRequest,
) -> CohostPublic:
    """更新 co-host 權限。"""
    await _load_session_for_host(db, session_id, host)
    result = await db.execute(
        select(Cohost).where(
            Cohost.id == cohost_id,
            Cohost.session_id == session_id,
            Cohost.status != CohostStatus.REVOKED,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 co-host")

    row.permissions_jsonb = _merge_permissions(payload.permissions)
    await audit_service.log(
        db,
        actor=host,
        action="cohost.update_permissions",
        target_type="cohost",
        target_id=cohost_id,
        session_id=session_id,
        details={"permissions": row.permissions_jsonb},
    )
    await db.commit()
    await db.refresh(row)
    return _to_public(row)


async def revoke(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    cohost_id: uuid.UUID,
    host: User,
) -> CohostPublic:
    """撤銷 co-host。"""
    await _load_session_for_host(db, session_id, host)
    result = await db.execute(
        select(Cohost).where(
            Cohost.id == cohost_id,
            Cohost.session_id == session_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 co-host")

    row.status = CohostStatus.REVOKED
    await audit_service.log(
        db,
        actor=host,
        action="cohost.revoke",
        target_type="cohost",
        target_id=cohost_id,
        session_id=session_id,
    )
    await db.commit()
    await db.refresh(row)
    return _to_public(row)
