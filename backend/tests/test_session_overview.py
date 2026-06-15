"""Session Overview API 測試（Host 即時總覽）。"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def test_session_participants_empty(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "Overview 參與者測試"},
    )
    assert create.status_code == 201
    session_id = create.json()["id"]

    resp = client.get(
        f"/api/v1/sessions/{session_id}/participants",
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_count"] == 0
    assert body["items"] == []
    assert body["next_cursor"] is None


def test_session_overview_after_create(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "Overview 總覽測試"},
    )
    assert create.status_code == 201
    session = create.json()
    session_id = session["id"]
    room_id = session["default_room_id"]

    resp = client.get(
        f"/api/v1/sessions/{session_id}/overview",
        headers=headers,
        params={"room_id": room_id},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["session_id"] == session_id
    assert body["title"] == "Overview 總覽測試"
    assert body["participant_count"] == 0
    assert body["engagement"]["qa_questions_total"] == 0
    assert body["engagement"]["poll_votes_total"] == 0
    assert body["active_poll"] is None
    assert body["top_questions"] == []
