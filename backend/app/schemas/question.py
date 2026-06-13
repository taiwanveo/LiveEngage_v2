"""Q&A 請求／回應 schema（FE-004／FE-005、BE-004）。"""

from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.enums import QuestionStatus, ReplyAuthorType


class QuestionSort(StrEnum):
    """公開列表排序（FE-005-FR1）。"""

    TOP = "top"
    NEWEST = "newest"


class VoteDirection(StrEnum):
    """投票方向（FE-005-FR2/FR3）。"""

    UP = "up"
    DOWN = "down"


class ModerateAction(StrEnum):
    """審核／現場動作（BE-004-FR2/FR3）。"""

    APPROVE = "approve"
    DISMISS = "dismiss"
    ARCHIVE = "archive"
    RESTORE = "restore"
    ANSWER = "answer"
    UNANSWER = "unanswer"
    HIGHLIGHT = "highlight"
    UNHIGHLIGHT = "unhighlight"


class QuestionCreateRequest(BaseModel):
    """提問（FE-004-FR1/FR2）。"""

    content: str = Field(min_length=1, max_length=1000)
    is_anonymous: bool = False


class QuestionPublic(BaseModel):
    """公開／廣播用問題物件（已過 mask_identity）。"""

    id: uuid.UUID
    room_id: uuid.UUID
    content: str
    author_display: str | None
    is_anonymous: bool
    status: QuestionStatus
    upvote_count: int
    downvote_count: int
    score: int
    highlighted: bool
    answered_at: dt.datetime | None
    label_id: uuid.UUID | None
    created_at: dt.datetime
    my_vote: VoteDirection | None = None


class QuestionListResponse(BaseModel):
    """公開問題列表（cursor 分頁）。"""

    items: list[QuestionPublic] = Field(default_factory=list)
    next_cursor: str | None = None


class VoteRequest(BaseModel):
    direction: VoteDirection = VoteDirection.UP


class VoteResult(BaseModel):
    """投票後最新計數（payload 帶絕對值，鐵律 2）。"""

    question_id: uuid.UUID
    upvote_count: int
    downvote_count: int
    score: int
    my_vote: VoteDirection | None


class ModerateRequest(BaseModel):
    action: ModerateAction


class ReplyCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    is_private: bool = False


class ReplyResponse(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    author_type: ReplyAuthorType
    content: str
    is_private: bool
    created_at: dt.datetime
