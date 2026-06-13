"""SSO schema。"""

from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.schemas.auth import TokenResponse


class SsoConfigResponse(BaseModel):
    enabled: bool
    provider: str
    label: str


class SsoExchangeRequest(BaseModel):
    ticket: str = Field(min_length=8, max_length=512)


class SsoExchangeResponse(TokenResponse):
    pass


class SsoParticipantJoinRequest(BaseModel):
    ticket: str = Field(min_length=8, max_length=512)
    session_id: uuid.UUID


class SsoParticipantJoinResponse(BaseModel):
    participant_token: str
    session_id: uuid.UUID
    room_id: uuid.UUID
    participant_id: uuid.UUID
    display_name: str | None = None
    email: str | None = None
