"""WebSocket Gateway smoke 測試。"""

from __future__ import annotations

import os

import pytest
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def test_ws_connect_with_participant_token(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """Participant token 可建立 WS 連線（SDS §6.1）。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create = client.post(
        "/api/v1/sessions",
        headers=headers,
        json={"title": "WS 測試"},
    )
    session_id = create.json()["id"]
    client.patch(
        f"/api/v1/sessions/{session_id}",
        headers=headers,
        json={"status": SessionStatus.LIVE.value},
    )
    state = client.get(f"/api/v1/sessions/{session_id}/state").json()
    room_id = state["rooms"][0]["id"]

    join = client.post(
        f"/api/v1/sessions/{session_id}/join",
        json={"name": "WsUser"},
    )
    pt = join.json()["participant_token"]

    with client.websocket_connect(
        f"/ws?token={pt}&room={room_id}&mode=participant"
    ) as ws:
        ws.send_text("pong")
        ping = ws.receive_json()
        assert ping["type"] == "ping"
