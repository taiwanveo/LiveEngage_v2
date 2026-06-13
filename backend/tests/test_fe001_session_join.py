"""FE-001/002 Session 與 Join 整合測試（對 Neon 或本地 PG）。"""

from __future__ import annotations

import os

import pytest
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def test_fe001_ac1_invalid_code_returns_not_found(client: TestClient) -> None:
    """FE-001-AC1：無效代碼回 404 SESSION_NOT_FOUND。"""
    resp = client.get("/api/v1/sessions/by-code/ZZZZZZ")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "SESSION_NOT_FOUND"


def test_fe001_ac1_join_flow(client: TestClient, host_token: tuple[str, str]) -> None:
    """FE-001-AC1/AC3/AC5：建立活動、開放、加入成功。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={
            "title": "測試活動",
            "visibility": "passcode",
            "passcode": "1234",
            "settings": {"require_name": True},
        },
    )
    assert create.status_code == 201, create.text
    session = create.json()
    code = session["code"]

    resolve = client.get(f"/api/v1/sessions/by-code/{code}")
    assert resolve.status_code == 200
    assert resolve.json()["status"] == "draft"

    join_before_live = client.post(
        f"/api/v1/sessions/{session['id']}/join",
        json={"passcode": "1234", "name": "Alice"},
    )
    assert join_before_live.status_code == 409
    assert join_before_live.json()["error"]["code"] == "SESSION_NOT_LIVE"

    live = client.patch(
        f"/api/v1/sessions/{session['id']}",
        headers=headers,
        json={"status": SessionStatus.LIVE.value},
    )
    assert live.status_code == 200

    bad_pass = client.post(
        f"/api/v1/sessions/{session['id']}/join",
        json={"passcode": "wrong", "name": "Alice"},
    )
    assert bad_pass.status_code == 422
    assert bad_pass.json()["error"]["code"] == "PASSCODE_INVALID"

    join = client.post(
        f"/api/v1/sessions/{session['id']}/join",
        json={"passcode": "1234", "name": "Alice"},
    )
    assert join.status_code == 200, join.text
    body = join.json()
    assert body["participant_token"]
    assert body["display_name"] == "Alice"


def test_host_list_sessions_includes_default_room(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """Host 活動列表含 default_room_id。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}

    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "列表測試活動"},
    )
    assert create.status_code == 201
    created = create.json()
    assert created.get("default_room_id")

    listing = client.get("/api/v1/sessions", headers=headers)
    assert listing.status_code == 200
    ids = {item["id"] for item in listing.json()["items"]}
    assert created["id"] in ids

    detail = client.get(f"/api/v1/sessions/{created['id']}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["default_room_id"] == created["default_room_id"]


def test_fe001_ac4_require_name(client: TestClient, host_token: tuple[str, str]) -> None:
    """FE-001-AC4：require_name 未填回 VALIDATION_ERROR。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "需姓名", "settings": {"require_name": True}},
    )
    session_id = create.json()["id"]
    client.patch(
        f"/api/v1/sessions/{session_id}",
        headers=headers,
        json={"status": SessionStatus.LIVE.value},
    )
    resp = client.post(f"/api/v1/sessions/{session_id}/join", json={})
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


def test_fe002_anonymous_masking(client: TestClient, host_token: tuple[str, str]) -> None:
    """FE-002：匿名加入時 display_name 遮蔽為 Anonymous。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "匿名測試"},
    )
    session_id = create.json()["id"]
    client.patch(
        f"/api/v1/sessions/{session_id}",
        headers=headers,
        json={"status": SessionStatus.LIVE.value},
    )
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join",
        json={"name": "Secret", "is_anonymous": True},
    )
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Anonymous"
    assert resp.json()["email"] is None
