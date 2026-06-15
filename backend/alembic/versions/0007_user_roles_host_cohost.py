"""user_role：member→host、新增 cohost

Revision ID: 0007_user_roles_host_cohost
"""

from __future__ import annotations

from alembic import op

revision = "0007_user_roles_host_cohost"
down_revision = "0006_sprint9_phase_d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'host'")
    op.execute("ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'cohost'")
    op.execute("UPDATE users SET role = 'host' WHERE role = 'member'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'host'::user_role")


def downgrade() -> None:
    op.execute("UPDATE users SET role = 'member' WHERE role = 'host'")
    op.execute("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'member'::user_role")
    # PostgreSQL 無法安全移除 enum 值，保留 host/cohost
