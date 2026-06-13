"""export_jobs

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-13

BE-012 匯出 Worker。expand-only。
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_UUID = postgresql.UUID(as_uuid=True)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if inspector.has_table("export_jobs"):
        return

    export_format = postgresql.ENUM(
        "csv", "xlsx", name="export_format", create_type=False
    )
    export_status = postgresql.ENUM(
        "pending",
        "processing",
        "completed",
        "failed",
        "expired",
        name="export_status",
        create_type=False,
    )
    bind.execute(sa.text(
        "DO $$ BEGIN CREATE TYPE export_format AS ENUM ('csv','xlsx'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    ))
    bind.execute(sa.text(
        "DO $$ BEGIN CREATE TYPE export_status AS ENUM "
        "('pending','processing','completed','failed','expired'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; END $$"
    ))

    op.create_table(
        "export_jobs",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "org_id",
            _UUID,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            _UUID,
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "requested_by",
            _UUID,
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("format", export_format, nullable=False),
        sa.Column("status", export_status, nullable=False, server_default="pending"),
        sa.Column("download_token", sa.String(128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.String(500), nullable=True),
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
    op.create_index("idx_export_jobs_org", "export_jobs", ["org_id", "created_at"])


def downgrade() -> None:
    op.drop_index("idx_export_jobs_org", table_name="export_jobs")
    op.drop_table("export_jobs")
    sa.Enum(name="export_format").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="export_status").drop(op.get_bind(), checkfirst=True)
