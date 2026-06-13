"""Sprint 5-3 Poll 整合測試（FE-006、BE-005；multiple_choice 先）。"""

from __future__ import annotations

import os
import uuid

import pytest
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

from tests.helpers import seed_host_user

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _live_session(client: TestClient, host_headers: dict[str, str]) -> dict[str, str]:
    create = client.post(
        "/api/v1/sessions", headers=host_headers, json={"title": "Poll 測試"}
    )
    assert create.status_code == 201, create.text
    session = create.json()
    live = client.patch(
        f"/api/v1/sessions/{session['id']}",
        headers=host_headers,
        json={"status": SessionStatus.LIVE.value},
    )
    assert live.status_code == 200
    return dict(session)


def _join(client: TestClient, session_id: str) -> tuple[str, str]:
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join", json={"name": "投票者"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["participant_token"], body["room_id"]


def _setup_mc_poll(
    client: TestClient,
    host_headers: dict[str, str],
    room_id: str,
) -> tuple[str, list[dict[str, object]]]:
    create = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=host_headers,
        json={"type": "multiple_choice", "title": "最愛水果"},
    )
    assert create.status_code == 201, create.text
    poll_id = str(create.json()["id"])
    opts = client.put(
        f"/api/v1/polls/{poll_id}/options",
        headers=host_headers,
        json={
            "options": [
                {"text": "蘋果", "order_no": 0},
                {"text": "香蕉", "order_no": 1},
            ]
        },
    )
    assert opts.status_code == 200, opts.text
    return poll_id, opts.json()


def _start_poll(
    client: TestClient, host_headers: dict[str, str], poll_id: str
) -> None:
    resp = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=host_headers,
        json={"action": "start"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "active"


def test_fe006_ac2_locked_returns_409(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-006-AC2：locked 狀態提交作答回 409。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_mc_poll(client, headers, room_id)
    _start_poll(client, headers, poll_id)

    lock = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "lock"},
    )
    assert lock.status_code == 200

    resp = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"option_ids": [str(uuid.uuid4())]}},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "POLL_INVALID_STATE"


def test_fe006_ac4_idle_returns_409(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-006-AC4：idle 狀態提交作答回 409。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, options = _setup_mc_poll(client, headers, room_id)

    resp = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"option_ids": [options[0]["id"]]}},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "POLL_INVALID_STATE"


def test_fe006_submit_and_results(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-006：multiple_choice 作答成功，Host 可讀結果；揭示前 participant 403。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, options = _setup_mc_poll(client, headers, room_id)
    _start_poll(client, headers, poll_id)
    hide = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "hide"},
    )
    assert hide.status_code == 200
    option_id = options[0]["id"]

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers={**_auth(ptoken), "Idempotency-Key": str(uuid.uuid4())},
        json={"answer": {"option_ids": [option_id]}},
    )
    assert submit.status_code == 201, submit.text
    assert submit.json()["submission_no"] == 0

    blocked = client.get(
        f"/api/v1/polls/{poll_id}/results",
        headers=_auth(ptoken),
    )
    assert blocked.status_code == 403

    host_results = client.get(
        f"/api/v1/polls/{poll_id}/results",
        headers=headers,
    )
    assert host_results.status_code == 200, host_results.text
    body = host_results.json()
    assert body["response_count"] == 1
    counts = {c["option_id"]: c["count"] for c in body["option_counts"]}
    assert counts[str(option_id)] == 1

    reveal = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "reveal"},
    )
    assert reveal.status_code == 200

    p_results = client.get(
        f"/api/v1/polls/{poll_id}/results",
        headers=_auth(ptoken),
    )
    assert p_results.status_code == 200
    assert p_results.json()["response_count"] == 1


def test_fe006_already_responded_without_allow_change(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-006：預設不允許更改答案時，第二次提交回 409 ALREADY_RESPONDED。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, options = _setup_mc_poll(client, headers, room_id)
    _start_poll(client, headers, poll_id)

    first = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"option_ids": [options[0]["id"]]}},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"option_ids": [options[1]["id"]]}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ALREADY_RESPONDED"


def _second_host(client: TestClient) -> str:
    email = f"host2-{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    seed_host_user(email=email, password=password)
    resp = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200
    return str(resp.json()["access_token"])


def test_be005_non_host_action_forbidden(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """BE-005：非該活動 org 的 Host 呼叫控場動作回 403。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    _, room_id = _join(client, session["id"])
    poll_id, _ = _setup_mc_poll(client, headers, room_id)

    other = _auth(_second_host(client))
    resp = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=other,
        json={"action": "start"},
    )
    assert resp.status_code == 403


def test_poll_start_stop_lifecycle(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """BE-005：start → stop 狀態轉移。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    _, room_id = _join(client, session["id"])
    poll_id, _ = _setup_mc_poll(client, headers, room_id)

    start = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "start"},
    )
    assert start.status_code == 200
    assert start.json()["status"] == "active"

    stop = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "stop"},
    )
    assert stop.status_code == 200
    assert stop.json()["status"] == "stopped"

    detail = client.get(f"/api/v1/polls/{poll_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["status"] == "stopped"
