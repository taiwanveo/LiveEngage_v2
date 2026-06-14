"""Poll 請求／回應 schema（FE-006~010、BE-003/005、PM-003/004；SDS §5.3、§7.4）。

答案載荷（answer_jsonb）的判別欄位在 ``interactions.type``（外部 tag），
故不用 Pydantic 內建 discriminated union，改以 :func:`parse_answer` 依題型選 model。
"""

from __future__ import annotations

import datetime as dt
import uuid
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models.enums import InteractionStatus, InteractionType

# ── 控場動作（BE-005-FR1、SDS §5.4）────────────────────────────────


class PollAction(StrEnum):
    """``POST /polls/{id}/actions`` 的動作。"""

    START = "start"
    STOP = "stop"
    LOCK = "lock"
    UNLOCK = "unlock"
    REVEAL = "reveal"
    HIDE = "hide"
    RESET = "reset"
    NEXT = "next"
    PREV = "prev"


class PollActionRequest(BaseModel):
    action: PollAction
    # reset 清除作答資料，需二次確認（BE-005-FR2）
    confirm: bool = False


# ── 各題型設定（存 interactions.settings_jsonb）─────────────────────


class MultipleChoiceSettings(BaseModel):
    """FE-006。"""

    multi_select: bool = False
    min_select: int = Field(default=1, ge=1)
    max_select: int = Field(default=1, ge=1)
    shuffle_options: bool = False
    has_correct: bool = False
    show_result: bool = True
    allow_change: bool = False
    show_voter_names: bool = False
    anonymous: bool = True


class WordCloudSettings(BaseModel):
    """FE-007。"""

    max_word_length: int = Field(default=25, ge=1, le=100)
    max_submissions: int = Field(default=3, ge=1, le=10)
    show_result: bool = True
    profanity_mode: Literal["off", "block", "mask", "review"] = "off"


class OpenTextSettings(BaseModel):
    """FE-008。"""

    multiline: bool = False
    max_length: int = Field(default=200, ge=1, le=1000)
    allow_multiple: bool = False
    show_voter_names: bool = False
    sort: Literal["newest", "oldest", "top"] = "newest"
    reactions_enabled: bool = False
    moderation_enabled: bool = False
    profanity_mode: Literal["off", "block", "mask", "review"] = "off"


class RatingSettings(BaseModel):
    """FE-009。"""

    min_value: int = Field(default=1, ge=0)
    max_value: int = Field(default=5, ge=1)
    display: Literal["number", "star", "emoji"] = "star"
    low_label: str | None = Field(default=None, max_length=50)
    high_label: str | None = Field(default=None, max_length=50)
    show_result: bool = True


class RankingSettings(BaseModel):
    """FE-010。"""

    top_n: int | None = Field(default=None, ge=1)
    shuffle_options: bool = False
    ranking_mode: Literal["average", "borda"] = "borda"
    show_result: bool = True


POLL_SETTINGS_MODELS: dict[InteractionType, type[BaseModel]] = {
    InteractionType.MULTIPLE_CHOICE: MultipleChoiceSettings,
    InteractionType.WORD_CLOUD: WordCloudSettings,
    InteractionType.OPEN_TEXT: OpenTextSettings,
    InteractionType.RATING: RatingSettings,
    InteractionType.RANKING: RankingSettings,
}


# ── 答案載荷（answer_jsonb；§7.4）──────────────────────────────────


class MultipleChoiceAnswer(BaseModel):
    option_ids: list[uuid.UUID] = Field(min_length=1)


class WordCloudAnswer(BaseModel):
    words: list[str] = Field(min_length=1)


class OpenTextAnswer(BaseModel):
    text: str = Field(min_length=1)


class RatingAnswer(BaseModel):
    value: int


class RankingAnswer(BaseModel):
    ranked_option_ids: list[uuid.UUID] = Field(min_length=1)


PollAnswer = (
    MultipleChoiceAnswer
    | WordCloudAnswer
    | OpenTextAnswer
    | RatingAnswer
    | RankingAnswer
)

ANSWER_MODELS: dict[InteractionType, type[BaseModel]] = {
    InteractionType.MULTIPLE_CHOICE: MultipleChoiceAnswer,
    InteractionType.WORD_CLOUD: WordCloudAnswer,
    InteractionType.OPEN_TEXT: OpenTextAnswer,
    InteractionType.RATING: RatingAnswer,
    InteractionType.RANKING: RankingAnswer,
}

# 可作為 Poll 的題型（排除 qa / quiz / survey / ideas）
POLL_TYPES = frozenset(ANSWER_MODELS.keys())


# ── 選項（Builder / 對外）──────────────────────────────────────────


class PollOptionInput(BaseModel):
    """建立／編輯選項（BE-003）。"""

    text: str = Field(min_length=1, max_length=100)
    is_correct: bool = False
    order_no: int = 0


class PollOptionPublic(BaseModel):
    """對外選項（揭示前不含 ``is_correct``）。"""

    id: uuid.UUID
    text: str
    order_no: int
    is_correct: bool | None = None


# ── 作答（FE-006~010）──────────────────────────────────────────────


class PollSubmitRequest(BaseModel):
    """提交作答；``answer`` 結構依題型，於 service 以 :func:`parse_answer` 驗證。"""

    answer: dict[str, object]


class PollSubmitResult(BaseModel):
    interaction_id: uuid.UUID
    submission_no: int
    accepted: bool = True


class PollActionResponse(BaseModel):
    """控場動作回應。"""

    poll_id: uuid.UUID
    status: InteractionStatus
    result_visible: bool
    """reveal 時附帶結果快照，Host 可免再打 GET /results。"""
    results: PollResults | None = None


class PollOptionsUpdateRequest(BaseModel):
    """取代 Poll 全部選項（BE-003 Builder）。"""

    options: list[PollOptionInput]


# ── 題目內容（GET /polls/{id}）─────────────────────────────────────


class PollDetail(BaseModel):
    """題目內容 + 個人作答狀態（揭示前不含正解）。"""

    id: uuid.UUID
    room_id: uuid.UUID
    type: InteractionType
    title: str | None
    description: str | None
    status: InteractionStatus
    result_visible: bool
    settings_public: dict[str, object]
    options: list[PollOptionPublic] = Field(default_factory=list)
    my_submitted: bool = False
    ends_at: dt.datetime | None = None


# ── 結果（GET /polls/{id}/results；後端聚合、絕對值，鐵律 2）────────


class OptionCount(BaseModel):
    option_id: uuid.UUID
    count: int


class WordCount(BaseModel):
    word: str
    count: int


class TextEntry(BaseModel):
    id: uuid.UUID
    text: str
    author_display: str | None
    created_at: dt.datetime


class PollResults(BaseModel):
    """結果聚合；依題型填對應欄位（其餘為 None）。"""

    interaction_id: uuid.UUID
    type: InteractionType
    status: InteractionStatus
    response_count: int
    # multiple_choice / ranking（borda 後的票數或得分）
    option_counts: list[OptionCount] | None = None
    # word_cloud
    word_counts: list[WordCount] | None = None
    # rating
    average: float | None = None
    distribution: dict[int, int] | None = None
    # open_text
    entries: list[TextEntry] | None = None


def parse_answer(itype: InteractionType, raw: dict[str, object]) -> PollAnswer:
    """依題型解析作答載荷；結構錯誤由呼叫端轉 400 VALIDATION_ERROR。"""
    model = ANSWER_MODELS.get(itype)
    if model is None:
        raise ValueError(f"{itype} 非可作答的 Poll 題型")
    return model.model_validate(raw)  # type: ignore[return-value]


def parse_settings(itype: InteractionType, raw: dict[str, object] | None) -> BaseModel:
    """依題型解析設定；缺省回該題型預設。"""
    model = POLL_SETTINGS_MODELS.get(itype)
    if model is None:
        raise ValueError(f"{itype} 無 Poll 設定")
    return model.model_validate(raw or {})


# mypy：明確匯出判別聯集，方便 service import
PollAnswerUnion = Annotated[PollAnswer, "external-tagged by interactions.type"]
