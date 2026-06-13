"""poll tables: poll_options, poll_responses + active-poll partial unique

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-13

對應 SDS §7.2 Poll 子表（Sprint 5–6）。expand-only；idempotent（沿用 0003 範式）。

額外：將 0001 的 ``idx_interactions_active``（非唯一 partial index）升級為
partial UNIQUE，於 DB 層硬保證「同一 room 同時僅一個 active 互動」（鐵律 5）。
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)
_JSONB = postgresql.JSONB(astext_type=sa.Text())
_TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table("poll_options"):
        op.create_table(
            "poll_options",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "interaction_id", _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False,
            ),
            sa.Column("text", sa.String(100), nullable=False),
            sa.Column(
                "is_correct", sa.Boolean(), nullable=False,
                server_default=sa.text("false"),
            ),
            sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
            sa.Column(
                "created_at", _TS, nullable=False, server_default=sa.text("now()")
            ),
        )
        op.create_index(
            "idx_poll_options_interaction", "poll_options",
            ["interaction_id", "order_no"],
        )

    if not inspector.has_table("poll_responses"):
        op.create_table(
            "poll_responses",
            sa.Column("id", _UUID, primary_key=True),
            sa.Column(
                "interaction_id", _UUID,
                sa.ForeignKey("interactions.id", ondelete="CASCADE"), nullable=False,
            ),
            sa.Column(
                "participant_id", _UUID,
                sa.ForeignKey("participants.id", ondelete="CASCADE"), nullable=False,
            ),
            sa.Column("answer_jsonb", _JSONB, nullable=False),
            sa.Column(
                "submission_no", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("is_correct", sa.Boolean(), nullable=True),
            sa.Column("score", sa.Numeric(), nullable=True),
            sa.Column("idempotency_key", _UUID, nullable=True),
            sa.Column("submitted_at", _TS, nullable=False),
            sa.UniqueConstraint(
                "interaction_id", "participant_id", "submission_no",
                name="uq_poll_responses_submission",
            ),
        )
        op.create_index(
            "idx_responses_interaction", "poll_responses",
            ["interaction_id", "submitted_at"],
        )
        # idempotency_key 唯一（鐵律 4）；NULL 不參與唯一（partial）
        op.execute(
            "CREATE UNIQUE INDEX uq_poll_responses_idem ON poll_responses "
            "(idempotency_key) WHERE idempotency_key IS NOT NULL"
        )

    # 將 active 互動 partial index 升級為 UNIQUE（鐵律 5 的 DB 硬保證）
    op.execute("DROP INDEX IF EXISTS idx_interactions_active")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_interactions_active_room "
        "ON interactions (room_id) WHERE status = 'active'"
    )


def downgrade() -> None:
    # 還原 active 互動索引為非唯一
    op.execute("DROP INDEX IF EXISTS uq_interactions_active_room")
    op.execute(
        "CREATE INDEX IF NOT EXISTS idx_interactions_active "
        "ON interactions (room_id) WHERE status = 'active'"
    )

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("poll_responses"):
        op.execute("DROP INDEX IF EXISTS uq_poll_responses_idem")
        op.drop_index("idx_responses_interaction", table_name="poll_responses")
        op.drop_table("poll_responses")
    if inspector.has_table("poll_options"):
        op.drop_index("idx_poll_options_interaction", table_name="poll_options")
        op.drop_table("poll_options")
