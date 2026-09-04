"""測試 AI 連線測試與自訂 Header 金鑰覆寫機制。"""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings


def test_ai_test_connection_without_key(client: TestClient) -> None:
    resp = client.post("/api/v1/ai/test-connection", json={})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "warning"
    assert "未設定 API Key" in data["message"]


def test_ai_test_connection_with_dummy_key(client: TestClient) -> None:
    # 測試傳入自訂 OpenRouter 金鑰
    resp = client.post(
        "/api/v1/ai/test-connection",
        json={
            "api_key": "sk-or-v1-invalid-dummy-key",
            "provider": "openrouter",
            "model": "google/gemini-2.0-flash-001",
            "base_url": "https://openrouter.ai/api/v1",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    # 預期因 dummy key 收到錯誤回應或失敗，但格式為結構化 status: error
    assert data["status"] in ("error", "ok")
    assert "provider" in data
    assert data["provider"] == "openrouter"


def test_generate_polls_with_custom_header_key(
    client: TestClient, host_token: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """驗證當伺服端無 key 時，若客戶端帶入 X-AI-API-Key Header，仍能成功處理請求。"""
    monkeypatch.setenv("LE_AI_API_KEY", "")
    get_settings.cache_clear()

    token, _ = host_token
    # 帶入 X-AI-API-Key Header
    headers = {
        "Authorization": f"Bearer {token}",
        "X-AI-API-Key": "sk-or-v1-test-header-key",
        "X-AI-Provider": "openrouter",
        "X-AI-Model": "google/gemini-2.0-flash-001",
    }
    resp = client.post(
        "/api/v1/ai/generate-polls",
        headers=headers,
        json={"topic": "團隊建設", "count": 2},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["polls"]) == 2
