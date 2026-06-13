"""audit_logs

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-13

對應 SDS §7.2、鐵律 10。expand-only。
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)
_TS = sa.DateTime(timezone=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("audit_logs"):
        # 既有環境（Neon 已先建表）— 跳過 DDL，僅標記 revision。
        return
    op.create_table(
        "audit_logs",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "org_id",
            _UUID,
            sa.ForeignKey("organizations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "actor_user_id",
            _UUID,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "session_id",
            _UUID,
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "room_id",
            _UUID,
            sa.ForeignKey("rooms.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", _UUID, nullable=True),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column(
            "details_jsonb",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at", _TS, nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index(
        "ix_audit_logs_org_created",
        "audit_logs",
        ["org_id", "created_at"],
    )
    op.create_index(
        "ix_audit_logs_session_created",
        "audit_logs",
        ["session_id", "created_at"],
    )
    op.create_index(
        "ix_audit_logs_actor_created",
        "audit_logs",
        ["actor_user_id", "created_at"],
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("audit_logs"):
        return
    op.drop_index("ix_audit_logs_actor_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_session_created", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_created", table_name="audit_logs")
    op.drop_table("audit_logs")
