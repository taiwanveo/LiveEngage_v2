"""Sprint 9 Phase D: quiz, ideas, cohost, survey, ai_request_logs

Revision ID: 0006
Revises: 0005
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)
_JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    bind = op.get_bind()

    for enum_sql in (
        "CREATE TYPE quiz_question_state AS ENUM ('pending','active','revealed','closed')",
        "CREATE TYPE cohost_status AS ENUM ('pending','accepted','revoked')",
        "CREATE TYPE ai_feature AS ENUM ('generate_polls','rewrite','question_assist','categorize_ideas','generate_quiz')",
    ):
        bind.execute(
            sa.text(
                f"DO $$ BEGIN {enum_sql}; EXCEPTION WHEN duplicate_object THEN NULL; END $$"
            )
        )

    quiz_state = postgresql.ENUM(
        "pending", "active", "revealed", "closed", name="quiz_question_state", create_type=False
    )
    cohost_st = postgresql.ENUM(
        "pending", "accepted", "revoked", name="cohost_status", create_type=False
    )
    ai_feat = postgresql.ENUM(
        "generate_polls",
        "rewrite",
        "question_assist",
        "categorize_ideas",
        "generate_quiz",
        name="ai_feature",
        create_type=False,
    )

    inspector = sa.inspect(bind)
    if not inspector.has_table("quiz_questions"):
        op.create_table(
            "quiz_questions",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "quiz_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "child_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("time_limit_s", sa.Integer(), nullable=False, server_default="30"),
            sa.Column("base_points", sa.Integer(), nullable=False, server_default="100"),
            sa.Column("speed_bonus", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("explanation", sa.Text(), nullable=True),
            sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("state", quiz_state, nullable=False, server_default="pending"),
            sa.Column(
                "started_at",
                sa.DateTime(timezone=True),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index(
            "idx_quiz_questions_quiz", "quiz_questions", ["quiz_interaction_id", "order_no"]
        )

    if not inspector.has_table("quiz_responses"):
        op.create_table(
            "quiz_responses",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "quiz_question_id",
                _UUID,
                sa.ForeignKey("quiz_questions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                _UUID,
                sa.ForeignKey("participants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("answer_jsonb", _JSONB, nullable=False),
            sa.Column("elapsed_ms", sa.Integer(), nullable=False),
            sa.Column("is_correct", sa.Boolean(), nullable=False),
            sa.Column("score", sa.Numeric(), nullable=False, server_default="0"),
            sa.Column(
                "submitted_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "quiz_question_id", "participant_id", name="uq_quiz_responses_participant"
            ),
        )

    if not inspector.has_table("ideas"):
        op.create_table(
            "ideas",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "board_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                _UUID,
                sa.ForeignKey("participants.id", ondelete="CASCADE"),
                nullable=True,
            ),
            sa.Column("content", sa.String(200), nullable=False),
            sa.Column("is_hidden", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("category", sa.String(100), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index("idx_ideas_board", "ideas", ["board_interaction_id", "created_at"])

    if not inspector.has_table("idea_reactions"):
        op.create_table(
            "idea_reactions",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "idea_id",
                _UUID,
                sa.ForeignKey("ideas.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                _UUID,
                sa.ForeignKey("participants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("emoji", sa.String(16), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "idea_id", "participant_id", "emoji", name="uq_idea_reactions"
            ),
        )

    if not inspector.has_table("cohosts"):
        op.create_table(
            "cohosts",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "session_id",
                _UUID,
                sa.ForeignKey("sessions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                _UUID,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("email", sa.String(255), nullable=False),
            sa.Column("status", cohost_st, nullable=False, server_default="pending"),
            sa.Column("is_external", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("permissions_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column(
                "invited_by",
                _UUID,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )
        op.create_index("idx_cohosts_session", "cohosts", ["session_id"])

    if not inspector.has_table("survey_questions"):
        op.create_table(
            "survey_questions",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "survey_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "child_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("required", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("page_no", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )

    if not inspector.has_table("survey_submissions"):
        op.create_table(
            "survey_submissions",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "survey_interaction_id",
                _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "participant_id",
                _UUID,
                sa.ForeignKey("participants.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("answers_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column("completed", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.UniqueConstraint(
                "survey_interaction_id",
                "participant_id",
                name="uq_survey_submissions_participant",
            ),
        )

    if not inspector.has_table("ai_request_logs"):
        op.create_table(
            "ai_request_logs",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "org_id",
                _UUID,
                sa.ForeignKey("organizations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "user_id",
                _UUID,
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
            sa.Column("feature", ai_feat, nullable=False),
            sa.Column("status", sa.String(32), nullable=False),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("is_ai_generated", sa.Boolean(), nullable=False, server_default="true"),
            sa.Column("details_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
        )


def downgrade() -> None:
    for t in (
        "ai_request_logs",
        "survey_submissions",
        "survey_questions",
        "cohosts",
        "idea_reactions",
        "ideas",
        "quiz_responses",
        "quiz_questions",
    ):
        op.drop_table(t)
    for name in ("ai_feature", "cohost_status", "quiz_question_state"):
        sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
