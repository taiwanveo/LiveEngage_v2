"""互動項目 schema（BE-002 子集；本 Sprint 供 Q&A 控場使用）。"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import InteractionStatus, InteractionType


class QaSettings(BaseModel):
    """Q&A 題型設定（存於 interactions.settings_jsonb；BE-004-FR4）。"""

    moderation_enabled: bool = False
    downvote_enabled: bool = False
    allow_participant_replies: bool = False
    max_question_length: int = Field(default=300, ge=50, le=1000)
    show_answered_separately: bool = True


class InteractionCreateRequest(BaseModel):
    type: InteractionType
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)


class InteractionUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=500)
    description: str | None = None
    status: InteractionStatus | None = None
    settings: dict[str, Any] | None = None
    result_visible: bool | None = None


class InteractionReorderRequest(BaseModel):
    """工作台左欄拖曳排序：傳入房間內所有非 Q&A 互動 id（新順序）。"""

    ordered_ids: list[uuid.UUID] = Field(min_length=1)


class InteractionResponse(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    type: InteractionType
    title: str | None
    description: str | None
    status: InteractionStatus
    order_no: int
    settings: dict[str, Any]
    result_visible: bool
    created_at: dt.datetime
    updated_at: dt.datetime
