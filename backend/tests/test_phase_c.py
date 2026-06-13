"""Phase C：rate limit 與匯出 Worker 測試。"""

from __future__ import annotations

import os
from unittest.mock import AsyncMock, patch

import pytest
from app.services.rate_limit_service import check_by_code_lookup, check_rate

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


@pytest.mark.asyncio
async def test_check_rate_raises_when_exceeded() -> None:
    """超過限制時拋 RATE_LIMITED。"""
    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(side_effect=[1, 2, 3])
    mock_redis.expire = AsyncMock()

    with patch("app.services.rate_limit_service.get_redis", return_value=mock_redis):
        await check_rate("rl:test:key", limit=2, message="too many")
        await check_rate("rl:test:key", limit=2, message="too many")
        with pytest.raises(Exception) as exc:
            await check_rate("rl:test:key", limit=2, message="too many")
        assert exc.value.__class__.__name__ == "AppError"


def test_by_code_rate_limit_integration(
    client, host_token: tuple[str, str]
) -> None:
    """by-code 查詢超過 30/min/IP 回 429。"""
    from fastapi.testclient import TestClient

    token, _ = host_token
    create = client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "RL 測試"},
    )
    code = create.json()["code"]

    mock_redis = AsyncMock()
    mock_redis.incr = AsyncMock(return_value=31)
    mock_redis.expire = AsyncMock()

    with patch("app.services.rate_limit_service.get_redis", return_value=mock_redis):
        resp = client.get(f"/api/v1/sessions/by-code/{code}")
        assert resp.status_code == 429, resp.text


def test_export_xlsx_format(
    client, host_token: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """BE-012：XLSX 匯出可建立並下載。"""
    monkeypatch.setenv("LE_CELERY_TASK_ALWAYS_EAGER", "true")
    from app.core.config import get_settings

    get_settings.cache_clear()

    token, _ = host_token
    create_sess = client.post(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {token}"},
        json={"title": "XLSX 匯出"},
    )
    session_id = create_sess.json()["id"]

    export = client.post(
        "/api/v1/admin/exports",
        headers={"Authorization": f"Bearer {token}"},
        json={"session_id": session_id, "format": "xlsx"},
    )
    assert export.status_code == 201, export.text
    job = export.json()
    assert job["status"] == "completed"
    assert job["download_url"] is not None

    dl = client.get(job["download_url"].replace("http://testserver", ""))
    assert dl.status_code == 200
    ct = dl.headers.get("content-type", "")
    assert "spreadsheet" in ct or "xlsx" in ct or len(dl.content) > 100
