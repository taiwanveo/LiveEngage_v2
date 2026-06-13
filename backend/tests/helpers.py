"""測試用同步 seed 工具（避免 asyncio.run 與 TestClient 衝突）。"""

from __future__ import annotations

import psycopg
from app.core.config import get_settings
from app.core.ids import uuid7
from app.core.security import hash_secret


def _sync_dsn() -> str:
    """將 SQLAlchemy sync URL 轉為 psycopg 可用的 DSN。"""
    url = get_settings().database_url_sync
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    return url


def seed_host_user(*, email: str, password: str, org_name: str = "Demo Org") -> None:
    """若不存在則以 sync psycopg 建立 org + host user。"""
    with psycopg.connect(_sync_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return
            org_id = uuid7()
            user_id = uuid7()
            cur.execute(
                """
                INSERT INTO organizations (id, name, plan, settings_jsonb)
                VALUES (%s, %s, %s, %s::jsonb)
                """,
                (org_id, org_name, "free", "{}"),
            )
            cur.execute(
                """
                INSERT INTO users (id, org_id, email, name, password_hash, role)
                VALUES (%s, %s, %s, %s, %s, %s::user_role)
                """,
                (user_id, org_id, email, "Host", hash_secret(password), "owner"),
            )
        conn.commit()
