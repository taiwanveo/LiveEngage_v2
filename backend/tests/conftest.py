"""pytest 共用設定。"""

from __future__ import annotations

import pytest
from app.core import db as db_module
from app.core.config import get_settings
from app.main import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    """提供 FastAPI 測試用 client。"""
    get_settings.cache_clear()
    db_module._engine = None
    db_module._sessionmaker = None
    return TestClient(create_app())


@pytest.fixture(autouse=True)
def _reset_db_engine() -> object:
    """每個測試後重置全域 engine，避免 event loop 衝突。"""
    yield
    db_module._engine = None
    db_module._sessionmaker = None
