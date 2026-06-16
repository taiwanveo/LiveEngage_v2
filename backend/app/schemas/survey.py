"""Survey 請求／回應 schema（BE-006、FE-012）。"""

from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field

from app.models.enums import InteractionType
from app.schemas.poll import PollOptionInput, PollOptionPublic


class SurveyQuestionCreateRequest(BaseModel):
    """新增 Survey 子題（child interaction）。"""

    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    question_type: InteractionType = InteractionType.MULTIPLE_CHOICE
    required: bool = True
    page_no: int = Field(default=0, ge=0)
    options: list[PollOptionInput] = Field(default_factory=list)
    # 評分題用
    rating_min: int = Field(default=1, ge=0, le=99)
    rating_max: int = Field(default=5, ge=1, le=100)


class SurveyQuestionPublic(BaseModel):
    id: uuid.UUID
    survey_interaction_id: uuid.UUID
    child_interaction_id: uuid.UUID
    title: str | None
    question_type: InteractionType
    required: bool
    page_no: int
    order_no: int
    options: list[PollOptionPublic] = Field(default_factory=list)


class SurveyQuestionParticipantPublic(BaseModel):
    """參與者作答用 Survey 子題（含選項，不含正確答案）。"""

    child_interaction_id: uuid.UUID
    title: str | None
    question_type: InteractionType
    required: bool
    page_no: int
    order_no: int
    options: list[PollOptionPublic] = Field(default_factory=list)
    settings: dict = Field(default_factory=dict)


class SurveySubmitRequest(BaseModel):
    """answers 以 child interaction id 字串為 key。"""

    answers: dict[str, object] = Field(default_factory=dict)
    completed: bool = True


class SurveySubmitResult(BaseModel):
    survey_interaction_id: uuid.UUID
    participant_id: uuid.UUID
    completed: bool


class SurveyAnswerCount(BaseModel):
    child_interaction_id: uuid.UUID
    title: str | None = None
    question_type: str | None = None
    response_count: int
    option_counts: dict[str, int] | None = None
    rating_counts: dict[str, int] | None = None


class SurveyResultsResponse(BaseModel):
    survey_interaction_id: uuid.UUID
    submission_count: int
    questions: list[SurveyAnswerCount] = Field(default_factory=list)


class SurveySubmissionAnswerDetail(BaseModel):
    """單一子題的作答內容（Host 工作台逐人檢視）。"""

    child_interaction_id: uuid.UUID
    question_title: str | None = None
    question_type: str
    answer_text: str


class SurveySubmissionDetail(BaseModel):
    """單一參與者的完整問卷提交。"""

    submission_id: uuid.UUID
    participant_id: uuid.UUID
    display_name: str | None = None
    submitted_at: dt.datetime | None = None
    answers: list[SurveySubmissionAnswerDetail] = Field(default_factory=list)


class SurveySubmissionsResponse(BaseModel):
    survey_interaction_id: uuid.UUID
    submissions: list[SurveySubmissionDetail] = Field(default_factory=list)
