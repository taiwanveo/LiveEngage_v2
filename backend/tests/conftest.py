"""pytest 共用設定。"""

from __future__ import annotations

import pytest
from app.main import create_app
from fastapi.testclient import TestClient


@pytest.fixture
def client() -> TestClient:
    """提供 FastAPI 測試用 client。"""
    return TestClient(create_app())
