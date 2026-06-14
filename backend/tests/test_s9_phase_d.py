"""Sprint 9 Phase D 整合測試（FE-011/012/013、BE-006/007、AI-001）。"""

from __future__ import annotations

import os
import uuid

import pytest
from app.core.config import get_settings
from app.models.enums import SessionStatus
from fastapi.testclient import TestClient

from tests.helpers import seed_host_user

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _live_session(client: TestClient, host_headers: dict[str, str]) -> dict[str, object]:
    create = client.post(
        "/api/v1/sessions", headers=host_headers, json={"title": "S9 測試"}
    )
    assert create.status_code == 201, create.text
    session = create.json()
    live = client.patch(
        f"/api/v1/sessions/{session['id']}",
        headers=host_headers,
        json={"status": SessionStatus.LIVE.value},
    )
    assert live.status_code == 200
    return session


def _join(
    client: TestClient, session_id: str, *, name: str = "參與者"
) -> tuple[str, str]:
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join", json={"name": name}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["participant_token"], body["room_id"]


def test_fe011_quiz_submit_and_leaderboard(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-011：Quiz 控場、作答、排行榜。"""
    token, _ = host_token
    headers = _auth(token)
    session = _live_session(client, headers)
    room_id = session["default_room_id"]
    assert room_id

    quiz = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
        json={"type": "quiz", "title": "快問快答"},
    )
    assert quiz.status_code == 201, quiz.text
    quiz_id = quiz.json()["id"]

    q = client.post(
        f"/api/v1/quizzes/{quiz_id}/questions",
        headers=headers,
        json={
            "title": "2+2=?",
            "time_limit_s": 30,
            "base_points": 100,
            "options": [
                {"text": "3", "is_correct": False, "order_no": 0},
                {"text": "4", "is_correct": True, "order_no": 1},
            ],
        },
    )
    assert q.status_code == 201, q.text
    question = q.json()
    correct_id = question["options"][1]["id"]

    start = client.post(
        f"/api/v1/quizzes/questions/{question['id']}/actions",
        headers=headers,
        json={"action": "start_question"},
    )
    assert start.status_code == 200, start.text

    part_token, _ = _join(client, str(session["id"]))
    part_headers = _auth(part_token)
    ans = client.post(
        f"/api/v1/quizzes/questions/{question['id']}/answers",
        headers=part_headers,
        json={"option_ids": [correct_id]},
    )
    assert ans.status_code == 201, ans.text
    assert ans.json()["is_correct"] is True

    board = client.get(
        f"/api/v1/quizzes/{quiz_id}/leaderboard",
        headers=headers,
    )
    assert board.status_code == 200, board.text
    entries = board.json()["entries"]
    assert len(entries) >= 1
    assert entries[0]["rank"] == 1


def test_fe013_ideas_submit_and_react(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-013：Ideas 提交與 emoji 反應。"""
    token, _ = host_token
    headers = _auth(token)
    session = _live_session(client, headers)
    room_id = session["default_room_id"]

    board = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
        json={"type": "ideas", "title": "點子牆"},
    )
    assert board.status_code == 201, board.text
    board_id = board.json()["id"]

    active = client.patch(
        f"/api/v1/interactions/{board_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert active.status_code == 200, active.text

    part_token, _ = _join(client, str(session["id"]))
    part_headers = _auth(part_token)
    idea = client.post(
        f"/api/v1/ideas-boards/{board_id}/ideas",
        headers=part_headers,
        json={"content": "加強 Wi-Fi"},
    )
    assert idea.status_code == 201, idea.text
    idea_id = idea.json()["id"]

    react = client.post(
        f"/api/v1/ideas/{idea_id}/react",
        headers=part_headers,
        json={"emoji": "👍"},
    )
    assert react.status_code == 200, react.text
    assert react.json()["reaction_total"] >= 1


def test_fe012_survey_submit(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-012：Survey 建立子題與提交。"""
    token, _ = host_token
    headers = _auth(token)
    session = _live_session(client, headers)
    room_id = session["default_room_id"]

    survey = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
        json={"type": "survey", "title": "活動回饋"},
    )
    assert survey.status_code == 201, survey.text
    survey_id = survey.json()["id"]

    sq = client.post(
        f"/api/v1/surveys/{survey_id}/questions",
        headers=headers,
        json={
            "title": "滿意度",
            "question_type": "rating",
            "required": True,
        },
    )
    assert sq.status_code == 201, sq.text
    child_id = sq.json()["child_interaction_id"]

    part_token, _ = _join(client, str(session["id"]))
    part_headers = _auth(part_token)
    submit = client.post(
        f"/api/v1/surveys/{survey_id}/submit",
        headers=part_headers,
        json={
            "answers": {child_id: {"value": 5}},
            "completed": True,
        },
    )
    assert submit.status_code == 201, submit.text

    results = client.get(
        f"/api/v1/surveys/{survey_id}/results",
        headers=headers,
    )
    assert results.status_code == 200, results.text


def test_activate_quiz_stops_existing_active_poll(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """開放 Quiz 時應先 stop 同 room 既有 active Poll（unique index）。"""
    token, _ = host_token
    headers = _auth(token)
    session = _live_session(client, headers)
    room_id = str(session["default_room_id"])

    poll = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
        json={"type": "open_text", "title": "進行中 Poll"},
    )
    assert poll.status_code == 201, poll.text
    poll_id = poll.json()["id"]

    start = client.post(
        f"/api/v1/polls/{poll_id}/actions",
        headers=headers,
        json={"action": "start"},
    )
    assert start.status_code == 200, start.text
    assert start.json()["status"] == "active"

    quiz = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
        json={"type": "quiz", "title": "快問快答"},
    )
    assert quiz.status_code == 201, quiz.text
    quiz_id = quiz.json()["id"]

    active = client.patch(
        f"/api/v1/interactions/{quiz_id}",
        headers=headers,
        json={"status": "active"},
    )
    assert active.status_code == 200, active.text
    assert active.json()["status"] == "active"

    listed = client.get(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=headers,
    )
    assert listed.status_code == 200, listed.text
    by_id = {item["id"]: item for item in listed.json()}
    assert by_id[poll_id]["status"] == "stopped"
    assert by_id[quiz_id]["status"] == "active"


def test_ai001_unavailable_without_key(
    client: TestClient, host_token: tuple[str, str], monkeypatch: pytest.MonkeyPatch
) -> None:
    """AI-001：未設定 ai_api_key 時回 503 AI_UNAVAILABLE。"""
    monkeypatch.setenv("LE_AI_API_KEY", "")
    get_settings.cache_clear()

    token, _ = host_token
    resp = client.post(
        "/api/v1/ai/generate-polls",
        headers=_auth(token),
        json={"topic": "團隊建設", "count": 2},
    )
    assert resp.status_code == 503, resp.text
    assert resp.json()["error"]["code"] == "AI_UNAVAILABLE"


def test_be012_cohost_forbidden_other_org(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """BE-012：非活動所屬 org 的使用者無法邀請 co-host。"""
    token, _ = host_token
    headers = _auth(token)
    session = _live_session(client, headers)

    other_email = f"other-{uuid.uuid4().hex[:8]}@example.com"
    seed_host_user(email=other_email, password="TestPass123!", org_name="Other Org")
    other_login = client.post(
        "/api/v1/auth/login",
        json={"email": other_email, "password": "TestPass123!"},
    )
    assert other_login.status_code == 200
    other_headers = _auth(other_login.json()["access_token"])

    resp = client.post(
        f"/api/v1/sessions/{session['id']}/cohosts",
        headers=other_headers,
        json={"email": "cohost@example.com"},
    )
    assert resp.status_code == 403, resp.text
