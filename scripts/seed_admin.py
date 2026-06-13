#!/usr/bin/env python3
"""建立或更新 LiveEngage 管理員（owner / admin）帳號。

讀取專案根目錄 ``.env`` 的 ``LE_DATABASE_URL_SYNC``（或 ``LE_DATABASE_URL``），
以同步 psycopg 寫入 ``organizations`` + ``users``。

用法（於專案根目錄，backend 虛擬環境已啟用）::

    python scripts/seed_admin.py --email you@company.com

互動式輸入密碼（不會 echo）；亦可一次性指定（勿寫入 shell history）::

    python scripts/seed_admin.py --email you@company.com --password 'YourPass123!'

將新管理員加入既有組織::

    python scripts/seed_admin.py --email you@company.com --org-id <uuid>

若 email 已存在，預設略過；加 ``--update`` 可重設密碼與角色。
"""

from __future__ import annotations

import argparse
import getpass
import sys
import uuid
from pathlib import Path

# 讓 ``from app...`` 在 repo 根目錄直接執行時可用
_BACKEND = Path(__file__).resolve().parents[1] / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import psycopg
from app.core.config import get_settings
from app.core.ids import uuid7
from app.core.security import hash_secret

_MIN_PASSWORD_LEN = 8


def _sync_dsn() -> str:
    settings = get_settings()
    url = settings.database_url_sync
    if url.startswith("postgresql+psycopg://"):
        return url.replace("postgresql+psycopg://", "postgresql://", 1)
    return url


def _read_password(args: argparse.Namespace) -> str:
    if args.password:
        raw = args.password
    else:
        raw = getpass.getpass("密碼（password，至少 8 字元）: ")
        confirm = getpass.getpass("再次輸入密碼（confirm）: ")
        if raw != confirm:
            print("兩次密碼不一致。", file=sys.stderr)
            sys.exit(1)
    if len(raw) < _MIN_PASSWORD_LEN:
        print(f"密碼至少 {_MIN_PASSWORD_LEN} 字元。", file=sys.stderr)
        sys.exit(1)
    return raw


def _parse_org_id(raw: str | None) -> uuid.UUID | None:
    if raw is None:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        print(f"無效的 --org-id: {raw}", file=sys.stderr)
        sys.exit(1)


def seed_admin(
    *,
    email: str,
    password: str,
    name: str,
    role: str,
    org_name: str,
    org_id: uuid.UUID | None,
    update: bool,
) -> None:
    email_norm = email.strip().lower()
    pwd_hash = hash_secret(password)

    with psycopg.connect(_sync_dsn()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, org_id, role FROM users WHERE lower(email) = %s",
                (email_norm,),
            )
            row = cur.fetchone()

            if row is not None:
                user_id, existing_org_id, existing_role = row
                if not update:
                    print(
                        f"使用者已存在：{email_norm}（role={existing_role}）。"
                        " 加 --update 可重設密碼與角色。"
                    )
                    return
                cur.execute(
                    """
                    UPDATE users
                    SET password_hash = %s, role = %s::user_role, name = %s,
                        updated_at = now()
                    WHERE id = %s
                    """,
                    (pwd_hash, role, name, user_id),
                )
                conn.commit()
                print(f"已更新管理員：{email_norm}（role={role}，org_id={existing_org_id}）")
                return

            if org_id is not None:
                cur.execute("SELECT id FROM organizations WHERE id = %s", (org_id,))
                if cur.fetchone() is None:
                    print(f"找不到組織 org_id={org_id}", file=sys.stderr)
                    sys.exit(1)
                target_org_id = org_id
            else:
                target_org_id = uuid7()
                cur.execute(
                    """
                    INSERT INTO organizations (id, name, plan, settings_jsonb)
                    VALUES (%s, %s, %s, %s::jsonb)
                    """,
                    (target_org_id, org_name, "free", "{}"),
                )

            user_id = uuid7()
            cur.execute(
                """
                INSERT INTO users (id, org_id, email, name, password_hash, role)
                VALUES (%s, %s, %s, %s, %s, %s::user_role)
                """,
                (user_id, target_org_id, email_norm, name, pwd_hash, role),
            )
        conn.commit()

    print(f"已建立管理員：{email_norm}（role={role}，org_id={target_org_id}）")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="建立或更新 LiveEngage 管理員（owner / admin）帳號。"
    )
    parser.add_argument("--email", required=True, help="登入用 Email")
    parser.add_argument(
        "--name",
        default=None,
        help="顯示名稱（預設取 email @ 前段）",
    )
    parser.add_argument(
        "--role",
        choices=("owner", "admin"),
        default="owner",
        help="角色（預設 owner）",
    )
    parser.add_argument(
        "--org-name",
        default="LiveEngage",
        help="新建組織時的名稱（預設 LiveEngage）",
    )
    parser.add_argument(
        "--org-id",
        default=None,
        help="加入既有組織的 UUID（省略則新建一個 organization）",
    )
    parser.add_argument(
        "--password",
        default=None,
        help="密碼明文（建議省略，改為互動輸入）",
    )
    parser.add_argument(
        "--update",
        action="store_true",
        help="若 email 已存在，重設 password_hash 與 role",
    )
    args = parser.parse_args()

    display_name = args.name or args.email.split("@", 1)[0]
    password = _read_password(args)
    org_id = _parse_org_id(args.org_id)

    seed_admin(
        email=args.email,
        password=password,
        name=display_name,
        role=args.role,
        org_name=args.org_name,
        org_id=org_id,
        update=args.update,
    )


if __name__ == "__main__":
    main()
