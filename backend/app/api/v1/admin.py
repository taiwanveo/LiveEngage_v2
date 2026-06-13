"""Admin API（BE-008/009/010）。

鐵律 8：所有端點要求 role >= ADMIN。
鐵律 10：變更動作由 admin_service 寫 audit log。
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user, require_role
from app.models.enums import SessionStatus, UserRole
from app.models.user import User
from app.schemas.admin import (
    AdminSessionListResponse,
    AdminSessionPatchRequest,
    AdminSessionResponse,
    AuditLogListResponse,
    MemberInviteRequest,
    MemberResponse,
    MemberUpdateRequest,
    OrgResponse,
    OrgUpdateRequest,
)
from app.services import admin_service

router = APIRouter(prefix="/admin", tags=["admin"])

# 要求 >= ADMIN 才可存取
_require_admin = Depends(require_role(UserRole.ADMIN))


# ── Organization ─────────────────────────────────────────────────────────────

@router.get("/organization", response_model=OrgResponse, dependencies=[_require_admin])
async def get_organization(
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> OrgResponse:
    """取得組織資料（BE-008）。"""
    return await admin_service.get_organization(db, actor)


@router.patch("/organization", response_model=OrgResponse, dependencies=[_require_admin])
async def update_organization(
    payload: OrgUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> OrgResponse:
    """更新組織資料（BE-008）。"""
    return await admin_service.update_organization(db, actor=actor, payload=payload)


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/members", response_model=list[MemberResponse], dependencies=[_require_admin])
async def list_members(
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> list[MemberResponse]:
    """列出組織成員（BE-008）。"""
    return await admin_service.list_members(db, actor)


@router.post(
    "/members",
    response_model=MemberResponse,
    status_code=201,
    dependencies=[_require_admin],
)
async def invite_member(
    payload: MemberInviteRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> MemberResponse:
    """邀請新成員（BE-008）。"""
    return await admin_service.invite_member(db, actor=actor, payload=payload)


@router.patch("/members/{user_id}", response_model=MemberResponse, dependencies=[_require_admin])
async def update_member(
    user_id: uuid.UUID,
    payload: MemberUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> MemberResponse:
    """更新成員角色（BE-008）。"""
    return await admin_service.update_member_role(
        db, actor=actor, user_id=user_id, payload=payload
    )


@router.delete("/members/{user_id}", status_code=204, dependencies=[_require_admin])
async def remove_member(
    user_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> None:
    """移除成員（BE-008）。"""
    await admin_service.remove_member(db, actor=actor, user_id=user_id)


# ── Sessions ──────────────────────────────────────────────────────────────────

@router.get("/sessions", response_model=AdminSessionListResponse, dependencies=[_require_admin])
async def list_sessions(
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
    status: Annotated[SessionStatus | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> AdminSessionListResponse:
    """列出組織所有活動（BE-009）。"""
    return await admin_service.list_sessions(
        db,
        actor=actor,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/sessions/{session_id}",
    response_model=AdminSessionResponse,
    dependencies=[_require_admin],
)
async def patch_session(
    session_id: uuid.UUID,
    payload: AdminSessionPatchRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
) -> AdminSessionResponse:
    """封存或更新活動狀態（BE-009）。"""
    return await admin_service.patch_session(
        db, actor=actor, session_id=session_id, payload=payload
    )


# ── Audit Logs ────────────────────────────────────────────────────────────────

@router.get("/audit-logs", response_model=AuditLogListResponse, dependencies=[_require_admin])
async def list_audit_logs(
    db: Annotated[AsyncSession, Depends(get_session)],
    actor: Annotated[User, Depends(get_current_user)],
    action: Annotated[str | None, Query(max_length=50)] = None,
    actor_user_id: Annotated[uuid.UUID | None, Query()] = None,
    session_id: Annotated[uuid.UUID | None, Query()] = None,
    target_type: Annotated[str | None, Query(max_length=50)] = None,
    date_from: Annotated[dt.datetime | None, Query()] = None,
    date_to: Annotated[dt.datetime | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 50,
) -> AuditLogListResponse:
    """查詢稽核紀錄（BE-010）。"""
    return await admin_service.list_audit_logs(
        db,
        actor=actor,
        action_filter=action,
        actor_user_id=actor_user_id,
        session_id=session_id,
        target_type=target_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
