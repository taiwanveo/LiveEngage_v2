"""pytest 共用設定。"""

from __future__ import annotations

import uuid

import pytest
from app.core import db as db_module
from app.core.config import get_settings
from app.main import create_app
from fastapi.testclient import TestClient

from tests.helpers import seed_host_user


@pytest.fixture
def client() -> TestClient:
    """提供 FastAPI 測試用 client（整合測試不連雲端 Redis，避免背景 task 與 event loop 衝突）。"""
    import os

    os.environ.setdefault("LE_CELERY_TASK_ALWAYS_EAGER", "true")
    get_settings.cache_clear()
    db_module._engine = None
    db_module._sessionmaker = None

    from app.core.redis import disable_redis_for_tests

    disable_redis_for_tests()

    with TestClient(create_app()) as test_client:
        yield test_client


@pytest.fixture
def host_token(client: TestClient) -> tuple[str, str]:
    """建立 host 並登入，回傳 (access_token, email)。"""
    email = f"host-{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    seed_host_user(email=email, password=password)
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"], email


@pytest.fixture(autouse=True)
def _reset_db_engine() -> object:
    """每個測試後重置全域 engine，避免 event loop 衝突。"""
    yield
    db_module._engine = None
    db_module._sessionmaker = None
