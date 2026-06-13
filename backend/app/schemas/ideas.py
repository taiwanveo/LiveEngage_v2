"""Ideas Board 請求／回應 schema（FE-013）。"""

from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class IdeaSort(StrEnum):
    TOP = "top"
    NEWEST = "newest"


class IdeaSubmitRequest(BaseModel):
    content: str = Field(min_length=1, max_length=200)
    category: str | None = Field(default=None, max_length=100)


class IdeaReactionSummary(BaseModel):
    emoji: str
    count: int
    reacted_by_me: bool = False


class IdeaPublic(BaseModel):
    id: uuid.UUID
    board_interaction_id: uuid.UUID
    content: str
    category: str | None
    is_hidden: bool
    author_display: str | None
    created_at: dt.datetime
    reactions: list[IdeaReactionSummary] = Field(default_factory=list)
    reaction_total: int = 0


class IdeaListResponse(BaseModel):
    items: list[IdeaPublic] = Field(default_factory=list)


class IdeaReactRequest(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)
