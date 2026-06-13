"""initial core chain: organizations→users→sessions→rooms→participants→interactions

Revision ID: 0001
Revises:
Create Date: 2026-06-13

對應 SDS §7.2 核心鏈資料表（任務 1）。expand-contract：本檔僅 forward。
"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# 共用型別
_UUID = postgresql.UUID(as_uuid=True)
_JSONB = postgresql.JSONB(astext_type=sa.Text())
_TS = sa.DateTime(timezone=True)

# ENUM 型別（create_type=False：由本檔顯式建立後重複使用，避免自動重建衝突）
user_role = postgresql.ENUM(
    "owner", "admin", "member", "guest", name="user_role", create_type=False
)
session_status = postgresql.ENUM(
    "draft", "live", "ended", "archived", name="session_status", create_type=False
)
session_visibility = postgresql.ENUM(
    "public", "hidden", "passcode", "sso", "restricted",
    name="session_visibility", create_type=False,
)
auth_method = postgresql.ENUM(
    "none", "passcode", "email", "sso", name="auth_method", create_type=False
)
interaction_type = postgresql.ENUM(
    "qa", "multiple_choice", "word_cloud", "open_text", "rating",
    "ranking", "quiz", "survey", "ideas",
    name="interaction_type", create_type=False,
)
interaction_status = postgresql.ENUM(
    "idle", "active", "locked", "stopped",
    name="interaction_status", create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    for enum in (
        user_role,
        session_status,
        session_visibility,
        auth_method,
        interaction_type,
        interaction_status,
    ):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "organizations",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("plan", sa.String(50), nullable=True),
        sa.Column("settings_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "users",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "org_id", _UUID,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("password_hash", sa.String(255), nullable=True),
        sa.Column("sso_provider", sa.String(50), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="member"),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "sessions",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "org_id", _UUID,
            sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "host_user_id", _UUID,
            sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_at", _TS, nullable=True),
        sa.Column("end_at", _TS, nullable=True),
        sa.Column("timezone", sa.String(64), nullable=True),
        sa.Column("language", sa.String(16), nullable=True),
        sa.Column("status", session_status, nullable=False, server_default="draft"),
        sa.Column("visibility", session_visibility, nullable=False, server_default="public"),
        sa.Column("passcode_hash", sa.String(255), nullable=True),
        sa.Column("settings_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("archived_at", _TS, nullable=True),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_sessions_org", "sessions", ["org_id", "status"])
    # partial + 函式唯一索引：同一活動代碼在 draft/live 狀態唯一（SDS §7.2）
    op.execute(
        "CREATE UNIQUE INDEX uq_sessions_code_active ON sessions (lower(code)) "
        "WHERE status IN ('draft', 'live')"
    )

    op.create_table(
        "rooms",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "session_id", _UUID,
            sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(255), nullable=True),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "participants",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column(
            "session_id", _UUID,
            sa.ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False,
        ),
        sa.Column(
            "room_id", _UUID,
            sa.ForeignKey("rooms.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("is_anonymous", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("auth_method", auth_method, nullable=False, server_default="none"),
        sa.Column("device_fingerprint", sa.String(128), nullable=True),
        sa.Column("is_preview", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("joined_at", _TS, nullable=True),
        sa.Column("last_seen_at", _TS, nullable=True),
    )
    op.create_index("idx_participants_session", "participants", ["session_id", "last_seen_at"])

    op.create_table(
        "interactions",
        sa.Column("id", _UUID, primary_key=True),
        sa.Column("room_id", _UUID, sa.ForeignKey("rooms.id", ondelete="CASCADE"), nullable=False),
        sa.Column("type", interaction_type, nullable=False),
        sa.Column("title", sa.String(500), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", interaction_status, nullable=False, server_default="idle"),
        sa.Column("order_no", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("settings_jsonb", _JSONB, nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("result_visible", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("started_at", _TS, nullable=True),
        sa.Column("stopped_at", _TS, nullable=True),
        sa.Column(
            "created_by", _UUID,
            sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
        ),
        sa.Column("created_at", _TS, nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", _TS, nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("idx_interactions_room", "interactions", ["room_id", "order_no"])
    # partial index：每房間僅一個 active 互動的查詢熱點（SDS §7.2）
    op.execute(
        "CREATE INDEX idx_interactions_active ON interactions (room_id) "
        "WHERE status = 'active'"
    )


def downgrade() -> None:
    op.drop_table("interactions")
    op.drop_table("participants")
    op.drop_table("rooms")
    op.drop_table("sessions")
    op.drop_table("users")
    op.drop_table("organizations")
    for name in (
        "interaction_status",
        "interaction_type",
        "auth_method",
        "session_visibility",
        "session_status",
        "user_role",
    ):
        op.execute(f"DROP TYPE IF EXISTS {name}")
