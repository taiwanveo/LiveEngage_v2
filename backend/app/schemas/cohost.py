"""Co-host 請求／回應 schema（BE-012）。"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.models.enums import CohostStatus


class CohostInviteRequest(BaseModel):
    email: EmailStr
    permissions: dict[str, bool] | None = None
    is_external: bool = True


class CohostPermissionsUpdateRequest(BaseModel):
    permissions: dict[str, bool]


class CohostPublic(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    user_id: uuid.UUID | None
    email: str
    status: CohostStatus
    is_external: bool
    permissions: dict[str, bool]
    invited_by: uuid.UUID | None
    created_at: dt.datetime
    updated_at: dt.datetime


class CohostListResponse(BaseModel):
    items: list[CohostPublic] = Field(default_factory=list)
