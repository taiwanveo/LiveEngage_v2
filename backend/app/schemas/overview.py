"""Session Overview schema（Host 即時總覽；Phase 1 MVP）。"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field

from app.models.enums import InteractionType, SessionStatus
from app.schemas.poll import PollOptionPublic, PollResults
from app.schemas.quiz import LeaderboardEntry


class ParticipantHostItem(BaseModel):
    """Host 可讀參與者列項（已 mask_identity；匿名不帶 id）。"""

    id: uuid.UUID | None = None
    display_name: str | None = None
    is_anonymous: bool
    joined_at: dt.datetime | None = None


class ParticipantListResponse(BaseModel):
    items: list[ParticipantHostItem] = Field(default_factory=list)
    total_count: int
    next_cursor: str | None = None


class EngagementSummary(BaseModel):
    """單一活動參與度摘要（對齊 Admin analytics 語意，session 級）。"""

    participant_count: int
    participants_engaged: int
    engaged_percent: int
    qa_questions_total: int
    poll_votes_total: int
    participants_qa: int
    participants_poll_voters: int


class OverviewQuestionSummary(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    content: str
    author_display: str | None
    is_anonymous: bool
    score: int
    upvote_count: int


class ActivePollOverview(BaseModel):
    interaction_id: uuid.UUID
    room_id: uuid.UUID
    title: str | None
    type: InteractionType
    options: list[PollOptionPublic] = Field(default_factory=list)
    results: PollResults


class QuizLeaderboardTop(BaseModel):
    quiz_interaction_id: uuid.UUID
    title: str | None
    entries: list[LeaderboardEntry] = Field(default_factory=list)


class SurveyOverviewSummary(BaseModel):
    survey_interaction_id: uuid.UUID
    title: str | None
    submission_count: int


class SessionOverviewResponse(BaseModel):
    session_id: uuid.UUID
    title: str
    status: SessionStatus
    focus_room_id: uuid.UUID | None = None
    participant_count: int
    engagement: EngagementSummary
    active_poll: ActivePollOverview | None = None
    top_questions: list[OverviewQuestionSummary] = Field(default_factory=list)
    quiz_leaderboard_top: QuizLeaderboardTop | None = None
    survey_summary: SurveyOverviewSummary | None = None
