"""Screen 投影狀態與 token 回應（Room 級遙控）。"""

from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum

from pydantic import BaseModel, Field


class ScreenViewKind(StrEnum):
    STANDBY = "standby"
    TEST = "test"
    OVERVIEW = "overview"
    POLL = "poll"
    QA = "qa"
    QUIZ = "quiz"
    IDEAS = "ideas"
    SURVEY = "survey"


class ScreenSubView(StrEnum):
    QUESTION = "question"
    RESULTS = "results"
    LEADERBOARD = "leaderboard"
    HOT_QUESTIONS = "hot_questions"


class ScreenDisplayState(BaseModel):
    """目前投影畫面狀態（Redis 快取）。"""

    view: ScreenViewKind = ScreenViewKind.STANDBY
    interaction_id: uuid.UUID | None = None
    sub_view: ScreenSubView | None = ScreenSubView.QUESTION
    session_id: uuid.UUID | None = None
    session_title: str | None = None
    updated_at: dt.datetime


class ScreenStateUpdateRequest(BaseModel):
    """Host 更新投影狀態。"""

    view: ScreenViewKind
    interaction_id: uuid.UUID | None = None
    sub_view: ScreenSubView | None = None
    session_title: str | None = None


class ScreenTokenResponse(BaseModel):
    token: str
    room_id: uuid.UUID
    expires_at: dt.datetime


class ScreenTokenRevokeResponse(BaseModel):
    revoked: bool = True
