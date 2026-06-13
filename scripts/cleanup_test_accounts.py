#!/usr/bin/env python3
"""清理整合測試殘留的 *@example.com 帳號與其組織資料。

讀取專案根目錄 ``.env`` 的 ``LE_DATABASE_URL_SYNC``。

用法（於專案根目錄）::

    python scripts/cleanup_test_accounts.py
    python scripts/cleanup_test_accounts.py --dry-run

僅刪除 email 符合 ``%@example.com`` 的 users 及其 organizations（若該 org 無其他正式用戶）。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import psycopg
from app.core.config import get_settings


def main() -> int:
    parser = argparse.ArgumentParser(description="清理 Neon 測試帳號 *@example.com")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="只列出將刪除的 email，不實際刪除",
    )
    args = parser.parse_args()

    settings = get_settings()
    dsn = settings.database_url_sync

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT u.id, u.email, u.org_id
                FROM users u
                WHERE lower(u.email) LIKE '%@example.com'
                ORDER BY u.email
                """
            )
            rows = cur.fetchall()
            if not rows:
                print("沒有符合 *@example.com 的測試帳號。")
                return 0

            print(f"找到 {len(rows)} 個測試帳號：")
            for _uid, email, _org in rows:
                print(f"  - {email}")

            if args.dry_run:
                print("（dry-run，未刪除）")
                return 0

            org_ids = {r[2] for r in rows}
            user_ids = [r[0] for r in rows]

            cur.execute(
                "DELETE FROM users WHERE id = ANY(%s::uuid[])",
                (user_ids,),
            )
            deleted_users = cur.rowcount

            deleted_orgs = 0
            for org_id in org_ids:
                cur.execute(
                    "SELECT count(*) FROM users WHERE org_id = %s",
                    (org_id,),
                )
                remaining = cur.fetchone()[0]
                if remaining == 0:
                    cur.execute("DELETE FROM organizations WHERE id = %s", (org_id,))
                    deleted_orgs += cur.rowcount

            conn.commit()
            print(f"已刪除 users: {deleted_users}，organizations: {deleted_orgs}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
