"""Admin 統計與 Analytics schema。"""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field

from app.models.enums import AiFeature


class AdminStatsOverview(BaseModel):
    sessions_total: int
    sessions_live: int
    participants_total: int
    poll_responses_total: int
    export_jobs_total: int
    ai_requests_total: int


class EngagementAnalytics(BaseModel):
    participants_total: int
    participants_qa: int
    participants_poll_voters: int
    engaged_score_percent: int
    poll_votes_total: int
    qa_questions_total: int


class AiRequestLogItem(BaseModel):
    id: uuid.UUID
    feature: AiFeature
    status: str
    latency_ms: int
    created_at: dt.datetime


class AiRequestLogListResponse(BaseModel):
    items: list[AiRequestLogItem] = Field(default_factory=list)
    total: int
    page: int
    page_size: int
