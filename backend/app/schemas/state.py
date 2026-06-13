"""Session 快照 schema（SDS §6.5、FE-003、RT-002）。"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field

from app.models.enums import SessionStatus


class RoomSnapshot(BaseModel):
    id: uuid.UUID
    name: str | None
    order_no: int


class ActiveInteractionSnapshot(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    type: str
    title: str | None
    status: str


class SessionStateResponse(BaseModel):
    """活動全量快照，供初載與 reconnect 使用。"""

    session_id: uuid.UUID
    title: str
    code: str
    status: SessionStatus
    language: str | None = None
    rooms: list[RoomSnapshot] = Field(default_factory=list)
    active_interactions: list[ActiveInteractionSnapshot] = Field(default_factory=list)
    participant_count: int = 0
    server_time: dt.datetime
