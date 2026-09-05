"""Q&A 相關資料表（SDS §7.2、§5.5）。

- ``questions``：提問主體；``score`` 為 generated stored 欄位（upvote − downvote）。
- ``question_votes``：每位參與者對每題僅一票（UNIQUE）。
- ``question_replies``：Host／參與者回覆，可標記私密（僅提問者可見）。
- ``question_labels``：問題標籤，可設定是否對參與者可見。
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import QuestionStatus, ReplyAuthorType


class Question(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """提問（FE-004／FE-005、BE-004）。"""

    __tablename__ = "questions"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    room_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[QuestionStatus] = mapped_column(
        pg_enum(QuestionStatus, "question_status"),
        nullable=False,
        default=QuestionStatus.PENDING,
    )
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    upvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downvote_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 反正規化排序分數（DB 自動維護）：score = upvote_count − downvote_count
    score: Mapped[int] = mapped_column(
        Integer,
        Computed("upvote_count - downvote_count", persisted=True),
        nullable=False,
    )
    label_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("question_labels.id", ondelete="SET NULL"),
        nullable=True,
    )
    highlighted_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    answered_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # AI-002: 被合併之主問題 ID（NULL 表示獨立問題；有值表示被歸併進該主問題，保留於 DB 不刪除）
    merged_into_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="SET NULL"),
        nullable=True,
    )
    # AI-002: 是否為主持人手動滑鼠拖曳合併（True: 手動, False: AI 語意聚合）
    is_manual_merge: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false", default=False
    )
    # 排序熱點索引 idx_questions_room_status_score（room_id, status, score DESC,
    # created_at DESC）為運算式索引，於 migration 以原生 DDL 建立。


class QuestionVote(UUIDPrimaryKeyMixin, Base):
    """投票紀錄；同一參與者對同一問題僅一筆（FE-005-AC6）。"""

    __tablename__ = "question_votes"

    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("participants.id", ondelete="CASCADE"),
        nullable=False,
    )
    # 1 = upvote、-1 = downvote
    direction: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("question_id", "participant_id", name="uq_question_votes"),
    )


class QuestionReply(UUIDPrimaryKeyMixin, Base):
    """問題回覆（BE-004-FR3）。"""

    __tablename__ = "question_replies"

    question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_type: Mapped[ReplyAuthorType] = mapped_column(
        pg_enum(ReplyAuthorType, "reply_author_type"),
        nullable=False,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), nullable=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )


class QuestionLabel(UUIDPrimaryKeyMixin, Base):
    """問題標籤（BE-004-FR4）。"""

    __tablename__ = "question_labels"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(16), nullable=True)
    visible_to_participants: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
