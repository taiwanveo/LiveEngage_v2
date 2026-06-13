"""Quiz 請求／回應 schema（BE-007、FE-011；SDS §4.5 計分）。"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.enums import QuizQuestionState
from app.schemas.poll import PollOptionInput, PollOptionPublic


class QuizAction(StrEnum):
    """``POST /quizzes/questions/{id}/actions`` 的控場動作。"""

    START_QUESTION = "start_question"
    REVEAL = "reveal"
    NEXT = "next"
    CLOSE = "close"


class QuizQuestionCreateRequest(BaseModel):
    """新增 Quiz 子題（含 multiple_choice 選項）。"""

    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    time_limit_s: int = Field(default=30, ge=5, le=300)
    base_points: int = Field(default=100, ge=0, le=10000)
    speed_bonus: bool = True
    explanation: str | None = None
    options: list[PollOptionInput] = Field(min_length=2, max_length=10)


class QuizQuestionPublic(BaseModel):
    """Quiz 子題對外表示。"""

    id: uuid.UUID
    quiz_interaction_id: uuid.UUID
    child_interaction_id: uuid.UUID
    title: str | None
    time_limit_s: int
    base_points: int
    speed_bonus: bool
    explanation: str | None
    order_no: int
    state: QuizQuestionState
    started_at: dt.datetime | None
    options: list[PollOptionPublic] = Field(default_factory=list)


class QuizActionRequest(BaseModel):
    action: QuizAction


class QuizActionResponse(BaseModel):
    question_id: uuid.UUID
    state: QuizQuestionState
    child_status: str


class QuizAnswerSubmitRequest(BaseModel):
    """提交 Quiz 作答；``option_ids`` 為單選。"""

    option_ids: list[uuid.UUID] = Field(min_length=1, max_length=1)


class QuizAnswerResult(BaseModel):
    quiz_question_id: uuid.UUID
    is_correct: bool
    score: Decimal
    elapsed_ms: int
    explanation: str | None = None


class LeaderboardEntry(BaseModel):
    participant_id: uuid.UUID
    display_name: str | None
    total_score: Decimal
    total_elapsed_ms: int
    rank: int


class QuizLeaderboardResponse(BaseModel):
    quiz_interaction_id: uuid.UUID
    entries: list[LeaderboardEntry] = Field(default_factory=list)
