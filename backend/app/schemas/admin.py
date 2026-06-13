"""Admin API schemas（BE-008/009/010）。"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import SessionStatus, SessionVisibility, UserRole

# ── Organization ────────────────────────────────────────────────────────────


class OrgResponse(BaseModel):
    id: uuid.UUID
    name: str
    plan: str | None
    settings_jsonb: dict[str, Any]
    created_at: dt.datetime
    updated_at: dt.datetime


class OrgUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    plan: str | None = Field(default=None, max_length=50)
    settings_jsonb: dict[str, Any] | None = None


# ── Members ─────────────────────────────────────────────────────────────────


class MemberResponse(BaseModel):
    id: uuid.UUID
    email: str
    name: str | None
    role: UserRole
    created_at: dt.datetime


class MemberUpdateRequest(BaseModel):
    role: UserRole


class MemberInviteRequest(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=255)
    role: UserRole = UserRole.MEMBER
    password: str = Field(min_length=8, max_length=128)


# ── Sessions ─────────────────────────────────────────────────────────────────


class AdminSessionResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    host_user_id: uuid.UUID
    title: str
    code: str
    status: SessionStatus
    visibility: SessionVisibility
    created_at: dt.datetime
    updated_at: dt.datetime
    archived_at: dt.datetime | None


class AdminSessionListResponse(BaseModel):
    items: list[AdminSessionResponse]
    total: int
    page: int
    page_size: int


class AdminSessionPatchRequest(BaseModel):
    """封存或切換狀態（BE-009）。"""

    status: SessionStatus | None = None


# ── Audit Logs ───────────────────────────────────────────────────────────────


class AuditLogResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID | None
    actor_user_id: uuid.UUID | None
    actor_email: str | None = None
    session_id: uuid.UUID | None
    room_id: uuid.UUID | None
    target_type: str
    target_id: uuid.UUID | None
    action: str
    details_jsonb: dict[str, Any]
    created_at: dt.datetime


class AuditLogListResponse(BaseModel):
    items: list[AuditLogResponse]
    total: int
    page: int
    page_size: int
