"""工作台互動項目拖曳排序 API 整合測試。"""

from __future__ import annotations

import os

import pytest
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _live_session(client: TestClient, host_headers: dict[str, str]) -> tuple[str, str]:
    create = client.post(
        "/api/v1/sessions", headers=host_headers, json={"title": "排序測試"}
    )
    assert create.status_code == 201, create.text
    session = create.json()
    live = client.patch(
        f"/api/v1/sessions/{session['id']}",
        headers=host_headers,
        json={"status": SessionStatus.LIVE.value},
    )
    assert live.status_code == 200
    join = client.post(
        f"/api/v1/sessions/{session['id']}/join", json={"name": "觀眾"}
    )
    assert join.status_code == 200, join.text
    return session["id"], join.json()["room_id"]


def _create_interaction(
    client: TestClient,
    host_headers: dict[str, str],
    room_id: str,
    *,
    interaction_type: str,
    title: str,
) -> str:
    resp = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=host_headers,
        json={"type": interaction_type, "title": title},
    )
    assert resp.status_code == 201, resp.text
    return str(resp.json()["id"])


def test_reorder_workbench_interactions(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """PUT reorder 應重設 order_no，且不影響 Q&A。"""
    token, _email = host_token
    headers = _auth(token)
    _session_id, room_id = _live_session(client, headers)

    poll_a = _create_interaction(
        client, headers, room_id, interaction_type="multiple_choice", title="A"
    )
    quiz_b = _create_interaction(
        client, headers, room_id, interaction_type="quiz", title="B"
    )
    qa_id = _create_interaction(
        client, headers, room_id, interaction_type="qa", title="Q&A"
    )

    reorder = client.put(
        f"/api/v1/rooms/{room_id}/interactions/reorder",
        headers=headers,
        json={"ordered_ids": [quiz_b, poll_a]},
    )
    assert reorder.status_code == 200, reorder.text
    body = reorder.json()
    assert [item["id"] for item in body] == [quiz_b, poll_a]
    assert body[0]["order_no"] == 0
    assert body[1]["order_no"] == 1

    listed = client.get(
        f"/api/v1/rooms/{room_id}/interactions", headers=headers
    )
    assert listed.status_code == 200, listed.text
    items = {str(i["id"]): i for i in listed.json()}
    assert items[quiz_b]["order_no"] == 0
    assert items[poll_a]["order_no"] == 1
    assert items[qa_id]["order_no"] >= 0
