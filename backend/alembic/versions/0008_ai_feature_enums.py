"""ai_feature: add cluster_words, generate_report, dedup_questions

Revision ID: 0008_ai_feature_enums
"""

from __future__ import annotations

from alembic import op

revision = "0008_ai_feature_enums"
down_revision = "0007_user_roles_host_cohost"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ai_feature ADD VALUE IF NOT EXISTS 'cluster_words'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ai_feature ADD VALUE IF NOT EXISTS 'generate_report'")
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE ai_feature ADD VALUE IF NOT EXISTS 'dedup_questions'")


def downgrade() -> None:
    pass
