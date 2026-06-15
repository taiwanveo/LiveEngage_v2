"""Sprint 5-3/5-4 Poll 整合測試（FE-006~010、BE-005）。"""

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


def _join(
    client: TestClient, session_id: str, *, name: str = "投票者"
) -> tuple[str, str]:
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join", json={"name": name}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["participant_token"], body["room_id"]


def _setup_poll(
    client: TestClient,
    host_headers: dict[str, str],
    room_id: str,
    *,
    poll_type: str,
    title: str,
    settings: dict[str, object] | None = None,
    options: list[dict[str, object]] | None = None,
) -> tuple[str, list[dict[str, object]] | None]:
    create = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=host_headers,
        json={
            "type": poll_type,
            "title": title,
            "settings": settings or {},
        },
    )
    assert create.status_code == 201, create.text
    poll_id = str(create.json()["id"])
    option_list: list[dict[str, object]] | None = None
    if options is not None:
        opts = client.put(
            f"/api/v1/polls/{poll_id}/options",
            headers=host_headers,
            json={"options": options},
        )
        assert opts.status_code == 200, opts.text
        option_list = opts.json()
    return poll_id, option_list


def _setup_mc_poll(
    client: TestClient,
    host_headers: dict[str, str],
    room_id: str,
) -> tuple[str, list[dict[str, object]]]:
    poll_id, opts = _setup_poll(
        client,
        host_headers,
        room_id,
        poll_type="multiple_choice",
        title="最愛水果",
        options=[
            {"text": "蘋果", "order_no": 0},
            {"text": "香蕉", "order_no": 1},
        ],
    )
    assert opts is not None
    return poll_id, opts


def _reveal_results(
    client: TestClient, host_headers: dict[str, str], poll_id: str
) -> None:
    resp = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=host_headers,
        json={"action": "reveal"},
    )
    assert resp.status_code == 200, resp.text


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
    assert start.json()["result_visible"] is False

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


def test_fe007_word_cloud_submit_and_counts(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-007：word_cloud 提交詞彙並聚合詞頻。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="word_cloud",
        title="關鍵字",
        settings={"max_submissions": 2},
    )
    _start_poll(client, headers, poll_id)

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"words": ["效率", "創新"]}},
    )
    assert submit.status_code == 201, submit.text

    _reveal_results(client, headers, poll_id)
    results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=headers
    )
    assert results.status_code == 200, results.text
    words = {w["word"]: w["count"] for w in results.json()["word_counts"]}
    assert words.get("效率") == 1
    assert words.get("創新") == 1


def test_fe007_max_submissions_exceeded(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-007-FR2：超過 max_submissions 回 409。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="word_cloud",
        title="關鍵字",
        settings={"max_submissions": 1},
    )
    _start_poll(client, headers, poll_id)

    first = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"words": ["效率"]}},
    )
    assert first.status_code == 201

    second = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"words": ["創新"]}},
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ALREADY_RESPONDED"


def test_fe009_rating_average(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-009：rating 提交後平均與分布正確。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="rating",
        title="滿意度",
        settings={"min_value": 1, "max_value": 5},
    )
    _start_poll(client, headers, poll_id)

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"value": 4}},
    )
    assert submit.status_code == 201, submit.text

    _reveal_results(client, headers, poll_id)
    results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=headers
    )
    assert results.status_code == 200, results.text
    body = results.json()
    assert body["average"] == 4.0
    assert body["distribution"]["4"] == 1


def test_fe009_rating_custom_scale(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-009：主持人可設定 1–10 評分尺度。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="rating",
        title="NPS",
        settings={"min_value": 1, "max_value": 10},
    )
    _start_poll(client, headers, poll_id)

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"value": 8}},
    )
    assert submit.status_code == 201, submit.text

    _reveal_results(client, headers, poll_id)
    results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=headers
    )
    body = results.json()
    assert body["average"] == 8.0
    assert body["distribution"]["8"] == 1


def test_fe009_rating_out_of_range_rejected(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-009：超出主持人設定區間的評分應拒絕。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="rating",
        title="超出範圍",
        settings={"min_value": 1, "max_value": 10},
    )
    _start_poll(client, headers, poll_id)

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"value": 11}},
    )
    assert submit.status_code == 400, submit.text
    assert submit.json()["error"]["code"] == "VALIDATION_ERROR"


def test_fe008_open_text_mask_voter_names(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-008：show_voter_names=false 時 participant 看不到作者名。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"], name="公開者")
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="open_text",
        title="建議",
        settings={"show_voter_names": False, "max_length": 200},
    )
    _start_poll(client, headers, poll_id)

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"text": "希望加強互動"}},
    )
    assert submit.status_code == 201

    _reveal_results(client, headers, poll_id)
    p_results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=_auth(ptoken)
    )
    assert p_results.status_code == 200
    entry = p_results.json()["entries"][0]
    assert entry["text"] == "希望加強互動"
    assert entry["author_display"] is None


def _join_anon(
    client: TestClient, session_id: str
) -> tuple[str, str]:
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join",
        json={"name": "匿名者", "is_anonymous": True},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["participant_token"], body["room_id"]


def test_fe008_anonymous_mask_on_results(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-008 + 鐵律 3：匿名參與者經 mask_identity 遮蔽。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join_anon(client, session["id"])
    poll_id, _ = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="open_text",
        title="匿名建議",
        settings={"show_voter_names": True, "max_length": 200},
    )
    _start_poll(client, headers, poll_id)

    client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"text": "匿名回饋"}},
    )

    _reveal_results(client, headers, poll_id)
    results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=headers
    )
    assert results.status_code == 200
    entry = results.json()["entries"][0]
    assert entry["author_display"] == "Anonymous"


def test_fe010_ranking_borda(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-010：ranking Borda 計分（第一名得分較高）。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    poll_id, options = _setup_poll(
        client,
        headers,
        room_id,
        poll_type="ranking",
        title="優先順序",
        settings={"ranking_mode": "borda"},
        options=[
            {"text": "A", "order_no": 0},
            {"text": "B", "order_no": 1},
            {"text": "C", "order_no": 2},
        ],
    )
    assert options is not None
    _start_poll(client, headers, poll_id)
    ranked = [options[0]["id"], options[1]["id"], options[2]["id"]]

    submit = client.post(
        f"/api/v1/polls/{poll_id}/responses",
        headers=_auth(ptoken),
        json={"answer": {"ranked_option_ids": ranked}},
    )
    assert submit.status_code == 201, submit.text

    _reveal_results(client, headers, poll_id)
    results = client.get(
        f"/api/v1/polls/{poll_id}/results", headers=headers
    )
    assert results.status_code == 200, results.text
    body = results.json()
    counts = {c["option_id"]: c["count"] for c in body["option_counts"]}
    assert counts[str(options[0]["id"])] > counts.get(str(options[2]["id"]), 0)
    order_counts = body.get("ranking_order_counts") or []
    assert len(order_counts) == 1
    assert order_counts[0]["order_key"] == "1,2,3"
    assert order_counts[0]["count"] == 1
    assert order_counts[0]["percentage"] == 100.0
    assert counts[str(options[0]["id"])] == 2
    assert counts[str(options[1]["id"])] == 1
    assert counts.get(str(options[2]["id"]), 0) == 0
