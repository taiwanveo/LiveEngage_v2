"""Session / Join 請求與回應 schema。"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import SessionStatus, SessionVisibility


class SessionSettings(BaseModel):
    """活動設定（存於 settings_jsonb；privacy_settings 表留待後續 migration）。"""

    require_name: bool = False
    require_email: bool = False
    allowed_email_domains: list[str] = Field(default_factory=list)
    anonymity_mode: str = "anon_default"


class SessionCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    timezone: str | None = None
    language: str | None = "zh-TW"
    visibility: SessionVisibility = SessionVisibility.PUBLIC
    passcode: str | None = Field(default=None, min_length=4, max_length=32)
    settings: SessionSettings = Field(default_factory=SessionSettings)


class SessionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: SessionStatus | None = None
    visibility: SessionVisibility | None = None
    passcode: str | None = Field(default=None, min_length=4, max_length=32)
    settings: SessionSettings | None = None


class SessionPublicResponse(BaseModel):
    """by-code 解析回應（不含機密）。"""

    id: uuid.UUID
    title: str
    code: str
    status: SessionStatus
    visibility: SessionVisibility
    require_name: bool
    require_email: bool
    language: str | None = None


class SessionHostResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    title: str
    code: str
    status: SessionStatus
    visibility: SessionVisibility
    settings: SessionSettings
    created_at: dt.datetime
    updated_at: dt.datetime


class JoinRequest(BaseModel):
    passcode: str | None = None
    name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = None
    is_anonymous: bool = False
    room_id: uuid.UUID | None = None


class JoinResponse(BaseModel):
    participant_token: str
    token_type: str = "bearer"
    session_id: uuid.UUID
    room_id: uuid.UUID | None
    participant_id: uuid.UUID
    display_name: str | None
    email: str | None
    is_anonymous: bool
