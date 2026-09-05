"""Q&A question merge and deduplication preservation (AI-002).

Revision ID: 0009
Revises: 0008_ai_feature_enums
Create Date: 2026-09-05
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009"
down_revision: str | None = "0008_ai_feature_enums"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    op.add_column(
        "questions",
        sa.Column(
            "merged_into_id",
            _UUID,
            sa.ForeignKey("questions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "questions",
        sa.Column(
            "is_manual_merge",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.create_index(
        "idx_questions_merged_into",
        "questions",
        ["merged_into_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_questions_merged_into", table_name="questions")
    op.drop_column("questions", "is_manual_merge")
    op.drop_column("questions", "merged_into_id")
