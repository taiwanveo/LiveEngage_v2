"""Poll 相關資料表（SDS §7.2、§7.4；Sprint 5–6）。

- ``poll_options``：選項（multiple_choice / ranking 用；rating/word_cloud/open_text 無選項）。
- ``poll_responses``：作答；``answer_jsonb`` 結構依 ``interactions.type``（§7.4）。

計數一律後端聚合（鐵律 2），熱點走 Redis ``agg:poll:{id}``；DB 為最終一致來源。
"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class PollOption(UUIDPrimaryKeyMixin, Base):
    """投票選項（FE-006 / FE-010）。"""

    __tablename__ = "poll_options"

    interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("interactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    text: Mapped[str] = mapped_column(String(100), nullable=False)
    # FE-006-FR3：正解設定（供 Quiz / 測驗）；揭示前不對外輸出
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: dt.datetime.now(dt.UTC),
    )

    __table_args__ = (
        Index("idx_poll_options_interaction", "interaction_id", "order_no"),
    )


class PollResponse(UUIDPrimaryKeyMixin, Base):
    """作答紀錄（FE-006~010）。

    ``answer_jsonb`` 結構依題型（§7.4）；``is_correct`` / ``score`` 留待 Quiz（Sprint 9+）。

    ``submission_no`` 調和 SDS §7.2「UNIQUE (interaction_id, participant_id) 由應用依
    settings 啟用」與多次提交需求：
    - 單次提交題型（multiple_choice / rating / ranking）固定 ``submission_no=0``，
      重複提交以 ``ON CONFLICT`` 更新同一筆。
    - 多次提交題型（word_cloud 多詞、open_text 多答）遞增 ``submission_no`` append。
    UNIQUE ``(interaction_id, participant_id, submission_no)`` 對兩者皆提供 DB 層保護。
    """

    __tablename__ = "poll_responses"

    interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("interactions.id", ondelete="CASCADE"),
        nullable=False,
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False,
    )
    answer_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    submission_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # Quiz 用（Sprint 9+）：本 Sprint 留 NULL
    is_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    score: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    idempotency_key: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), nullable=True
    )
    submitted_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        UniqueConstraint(
            "interaction_id",
            "participant_id",
            "submission_no",
            name="uq_poll_responses_submission",
        ),
        Index("idx_responses_interaction", "interaction_id", "submitted_at"),
    )
