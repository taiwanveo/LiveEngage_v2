"""Room schema（多房間）。"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field


class RoomResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    name: str | None
    description: str | None
    slug: str | None
    order_no: int
    created_at: dt.datetime
    updated_at: dt.datetime


class RoomCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None
    slug: str | None = Field(default=None, max_length=255)


class RoomListResponse(BaseModel):
    items: list[RoomResponse] = Field(default_factory=list)
