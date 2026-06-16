"""Screen 投影 API 整合測試。"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def _create_live_session(client: TestClient, token: str) -> tuple[str, str]:
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "Screen 測試活動", "visibility": "public"},
    )
    assert create.status_code == 201, create.text
    session = create.json()
    live = client.patch(
        f"/api/v1/sessions/{session['id']}",
        headers=headers,
        json={"status": "live"},
    )
    assert live.status_code == 200
    room_id = session["default_room_id"]
    assert room_id
    return session["id"], room_id


def test_screen_token_and_state_flow(client: TestClient, host_token: tuple[str, str]) -> None:
    """Host 簽發 screen token、更新狀態、Screen token 可讀。"""
    access, _ = host_token
    host_headers = {"Authorization": f"Bearer {access}"}
    _, room_id = _create_live_session(client, access)

    mint = client.post(
        f"/api/v1/rooms/{room_id}/screen-token",
        headers=host_headers,
    )
    assert mint.status_code == 200, mint.text
    screen_token = mint.json()["token"]
    screen_headers = {"Authorization": f"Bearer {screen_token}"}

    get0 = client.get(f"/api/v1/rooms/{room_id}/screen", headers=screen_headers)
    assert get0.status_code == 200
    assert get0.json()["view"] == "standby"

    update = client.put(
        f"/api/v1/rooms/{room_id}/screen",
        headers={
            **host_headers,
            "Idempotency-Key": str(uuid.uuid4()),
        },
        json={"view": "test", "session_title": "Screen 測試活動"},
    )
    assert update.status_code == 200
    assert update.json()["view"] == "test"

    get1 = client.get(f"/api/v1/rooms/{room_id}/screen", headers=screen_headers)
    assert get1.status_code == 200
    assert get1.json()["view"] == "test"

    revoke = client.post(
        f"/api/v1/rooms/{room_id}/screen-token/revoke",
        headers=host_headers,
    )
    assert revoke.status_code == 200

    get_revoked = client.get(f"/api/v1/rooms/{room_id}/screen", headers=screen_headers)
    assert get_revoked.status_code == 401


def test_screen_state_forbidden_room(client: TestClient, host_token: tuple[str, str]) -> None:
    """Screen token 不可讀其他房間。"""
    access, _ = host_token
    _, room_id = _create_live_session(client, access)
    mint = client.post(
        f"/api/v1/rooms/{room_id}/screen-token",
        headers={"Authorization": f"Bearer {access}"},
    )
    screen_token = mint.json()["token"]
    other_room = str(uuid.uuid4())
    resp = client.get(
        f"/api/v1/rooms/{other_room}/screen",
        headers={"Authorization": f"Bearer {screen_token}"},
    )
    assert resp.status_code == 403
