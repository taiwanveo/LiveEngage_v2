"""api_public_base_url 單元測試。"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from app.core.config import get_settings
from app.core.public_url import api_public_base_url


def test_api_public_base_url_prefers_configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LE_API_PUBLIC_URL", "https://le-api.zeabur.app")
    get_settings.cache_clear()
    request = MagicMock()
    request.base_url = "http://127.0.0.1:8000/"
    assert api_public_base_url(request=request) == "https://le-api.zeabur.app"
    get_settings.cache_clear()


def test_api_public_base_url_falls_back_to_request(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("LE_API_PUBLIC_URL", raising=False)
    get_settings.cache_clear()
    request = MagicMock()
    request.base_url = "http://testserver/"
    assert api_public_base_url(request=request) == "http://testserver"
    get_settings.cache_clear()
