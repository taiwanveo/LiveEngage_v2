"""Sprint 9 模型：Quiz / Ideas / Co-host / Survey / AI logs。"""

from __future__ import annotations

import datetime as dt
import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import AiFeature, CohostStatus, QuizQuestionState


class QuizQuestion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "quiz_questions"

    quiz_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    child_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    time_limit_s: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    base_points: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    speed_bonus: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    state: Mapped[QuizQuestionState] = mapped_column(
        pg_enum(QuizQuestionState, "quiz_question_state"), nullable=False, default=QuizQuestionState.PENDING
    )
    started_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class QuizResponse(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "quiz_responses"

    quiz_question_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("quiz_questions.id", ondelete="CASCADE"), nullable=False
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )
    answer_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    elapsed_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric, nullable=False, default=0)
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("quiz_question_id", "participant_id", name="uq_quiz_responses_participant"),
    )


class Idea(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ideas"

    board_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    participant_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("participants.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[str] = mapped_column(String(200), nullable=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class IdeaReaction(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "idea_reactions"

    idea_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )
    emoji: Mapped[str] = mapped_column(String(16), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint("idea_id", "participant_id", "emoji", name="uq_idea_reactions"),
    )


class Cohost(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "cohosts"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[CohostStatus] = mapped_column(
        pg_enum(CohostStatus, "cohost_status"), nullable=False, default=CohostStatus.PENDING
    )
    is_external: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    permissions_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )


class SurveyQuestion(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "survey_questions"

    survey_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    child_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    page_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class SurveySubmission(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "survey_submissions"

    survey_interaction_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("participants.id", ondelete="CASCADE"), nullable=False
    )
    answers_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    submitted_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "survey_interaction_id", "participant_id", name="uq_survey_submissions_participant"
        ),
    )


class AiRequestLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "ai_request_logs"

    org_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    feature: Mapped[AiFeature] = mapped_column(pg_enum(AiFeature, "ai_feature"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    latency_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    details_jsonb: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), nullable=False)
