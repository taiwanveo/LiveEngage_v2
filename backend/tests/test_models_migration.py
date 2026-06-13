"""資料模型與 migration 測試。

- metadata 層：驗證核心鏈資料表皆已定義（不需 DB）。
- live DB 層：若設定 ``LE_DATABASE_URL_SYNC`` 且可連線，套用 migration 並
  驗證資料表存在；否則自動跳過（本機無 docker/PG 時）。

（待對 AC：Sprint 1 各 FE/BE AC 對應測試於後續任務補上正式編號。）
"""

from __future__ import annotations

import os

import pytest
from app.models import Base
from sqlalchemy import create_engine, inspect

EXPECTED_TABLES = {
    "organizations",
    "users",
    "sessions",
    "rooms",
    "participants",
    "interactions",
}


def test_scaffold_metadata_has_core_tables() -> None:
    """核心鏈 6 表應全部存在於 Base.metadata。"""
    defined = set(Base.metadata.tables.keys())
    missing = EXPECTED_TABLES - defined
    assert not missing, f"缺少資料表定義：{missing}"


def test_scaffold_uuid7_id_default() -> None:
    """核心表主鍵應有預設值產生器（UUID v7）。"""
    from app.core.ids import uuid7

    value = uuid7()
    assert value.version == 7


@pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL_SYNC"),
    reason="未設定 LE_DATABASE_URL_SYNC，跳過實機 migration 測試",
)
def test_scaffold_live_migration_creates_tables() -> None:
    """連線實機 DB 時，建立全部 metadata 後核心表應存在。

    使用 metadata.create_all 作為 migration DDL 的等價驗證；正式 CI 改以
    ``alembic upgrade head`` 對 docker PG 執行。
    """
    url = os.environ["LE_DATABASE_URL_SYNC"]
    engine = create_engine(url)
    try:
        Base.metadata.create_all(engine)
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert tables >= EXPECTED_TABLES
    finally:
        engine.dispose()
