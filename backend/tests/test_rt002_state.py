"""Session state 快照 API 測試（RT-002）。"""

from __future__ import annotations

import os

import pytest
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def test_rt002_state_snapshot_after_create(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """建立活動後 GET /state 應回傳 rooms 與 server_time。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "快照測試"},
    )
    assert create.status_code == 201
    session_id = create.json()["id"]

    resp = client.get(f"/api/v1/sessions/{session_id}/state")
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == session_id
    assert len(body["rooms"]) >= 1
    assert body["status"] == SessionStatus.DRAFT.value
    assert "server_time" in body
