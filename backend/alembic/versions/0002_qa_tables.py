"""Q&A tables: question_labels, questions, question_votes, question_replies

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-13

對應 SDS §7.2 Q&A 子表（Sprint 3）。expand-contract：本檔僅 forward。
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)
_TS = sa.DateTime(timezone=True)

question_status = postgresql.ENUM(
    "pending", "approved", "dismissed", "answered", "archived",
    name="question_status", create_type=False,
)
reply_author_type = postgresql.ENUM(
    "host", "participant", name="reply_author_type", create_type=False
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (question_status, reply_author_type):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "question_labels",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "session_id", _UUID,
            sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(16), nullable=True),
        sa.Column(
            "visible_to_participants", sa.Boolean(),
            nullable=False, server_default=sa.text("false"),
        ),
    )

    op.create_table(
        "questions",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "session_id", _UUID,
            sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "room_id", _UUID,
            sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "participant_id", _UUID,
            sa.ForeignKey("participants.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("status", question_status, nullable=False, server_default="pending"),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("upvote_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("downvote_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "score", sa.Integer(),
            sa.Computed("upvote_count - downvote_count", persisted=True),
            nullable=False,
        ),
        sa.Column(
            "label_id", _UUID,
            sa.ForeignKey("question_labels.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("highlighted_at", _TS, nullable=True),
        sa.Column("answered_at", _TS, nullable=True),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )
    # 熱門排序覆蓋索引（SDS §7.2）
    op.execute(
        "CREATE INDEX idx_questions_room_status_score ON questions "
        "(room_id, status, score DESC, created_at DESC)"
    )
    # 最新排序覆蓋索引（SDS §7.3）
    op.execute(
        "CREATE INDEX idx_questions_room_status_created ON questions "
        "(room_id, status, created_at DESC)"
    )

    op.create_table(
        "question_votes",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "question_id", _UUID,
            sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "participant_id", _UUID,
            sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("direction", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("question_id", "participant_id", name="uq_question_votes"),
    )

    op.create_table(
        "question_replies",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "question_id", _UUID,
            sa.ForeignKey("questions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("author_type", reply_author_type, nullable=False),
        sa.Column("author_id", _UUID, nullable=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("is_private", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index(
        "idx_question_replies_question", "question_replies", ["question_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_table("question_replies")
    op.drop_table("question_votes")
    op.drop_table("questions")
    op.drop_table("question_labels")
    for name in ("reply_author_type", "question_status"):
        op.execute(f"DROP TYPE IF EXISTS {name}")
