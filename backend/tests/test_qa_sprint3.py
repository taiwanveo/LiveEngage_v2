"""Sprint 3 Q&A 整合測試（FE-004／FE-005／BE-004 AC，對 Neon 或本地 PG）。"""

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


def _second_host(client: TestClient) -> str:
    """建立另一個 org 的 host，回傳 access token。"""
    email = f"host2-{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPass123!"
    seed_host_user(email=email, password=password)
    resp = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert resp.status_code == 200
    return str(resp.json()["access_token"])


def _live_session(client: TestClient, host_headers: dict[str, str]) -> dict[str, str]:
    create = client.post(
        "/api/v1/sessions", headers=host_headers, json={"title": "Q&A 測試"}
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


def _join(client: TestClient, session_id: str, *, name: str = "P") -> tuple[str, str]:
    """加入活動，回傳 (participant_token, room_id)。"""
    resp = client.post(
        f"/api/v1/sessions/{session_id}/join", json={"name": name}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    return body["participant_token"], body["room_id"]


def _open_qa(
    client: TestClient,
    host_headers: dict[str, str],
    room_id: str,
    *,
    settings: dict[str, object] | None = None,
) -> str:
    """在房間建立並開放一個 Q&A 互動，回傳 interaction id。"""
    create = client.post(
        f"/api/v1/rooms/{room_id}/interactions",
        headers=host_headers,
        json={"type": "qa", "title": "Q&A", "settings": settings or {}},
    )
    assert create.status_code == 201, create.text
    interaction_id = create.json()["id"]
    activate = client.patch(
        f"/api/v1/interactions/{interaction_id}",
        headers=host_headers,
        json={"status": "active"},
    )
    assert activate.status_code == 200, activate.text
    return str(interaction_id)


def test_fe004_ac2_submit_without_moderation_is_approved(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-004-AC2：未啟用審核時提問直接 approved 並出現在公開清單。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": False})

    resp = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "這是一個問題"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "approved"

    listing = client.get(f"/api/v1/rooms/{room_id}/questions")
    assert listing.status_code == 200
    contents = [q["content"] for q in listing.json()["items"]]
    assert "這是一個問題" in contents


def test_fe004_ac3_pending_not_in_public_list(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-004-AC3：啟用審核時問題 pending，不出現在公開清單；審核後出現。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": True})

    submit = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "待審問題"},
    )
    assert submit.status_code == 201
    qid = submit.json()["id"]
    assert submit.json()["status"] == "pending"

    public = client.get(f"/api/v1/rooms/{room_id}/questions")
    assert "待審問題" not in [q["content"] for q in public.json()["items"]]

    moderation = client.get(
        f"/api/v1/rooms/{room_id}/questions/moderation",
        headers=headers,
        params={"status": "pending"},
    )
    assert moderation.status_code == 200
    assert qid in [q["id"] for q in moderation.json()]

    approve = client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=headers,
        json={"action": "approve"},
    )
    assert approve.status_code == 200
    assert approve.json()["status"] == "approved"

    public2 = client.get(f"/api/v1/rooms/{room_id}/questions")
    assert "待審問題" in [q["content"] for q in public2.json()["items"]]


def test_fe004_qa_closed_rejects_submit(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-004-FR7：Q&A 未開放時提問回 QA_CLOSED。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    # 不建立／不開放 qa
    resp = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "沒開放"},
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "QA_CLOSED"


def test_fe005_ac6_upvote_toggle_counts_once(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-005-AC6：同一參與者重複 upvote 僅計一票（再次點擊取消）。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id)
    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "投票題"},
    ).json()["id"]

    v1 = client.post(f"/api/v1/questions/{qid}/vote", headers=_auth(ptoken), json={})
    assert v1.status_code == 200
    assert v1.json()["upvote_count"] == 1
    assert v1.json()["my_vote"] == "up"

    v2 = client.post(f"/api/v1/questions/{qid}/vote", headers=_auth(ptoken), json={})
    assert v2.status_code == 200
    assert v2.json()["upvote_count"] == 0
    assert v2.json()["my_vote"] is None


def test_fe005_ac5_vote_on_pending_forbidden(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-005-AC5：對 pending 問題投票回 403。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": True})
    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "待審不可投票"},
    ).json()["id"]

    resp = client.post(f"/api/v1/questions/{qid}/vote", headers=_auth(ptoken), json={})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


def test_fe005_ac4_downvote_requires_enabled(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """FE-005-AC4：downvote 未啟用回 403；啟用後反映於分數。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    interaction_id = _open_qa(
        client, headers, room_id, settings={"downvote_enabled": False}
    )
    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "downvote 題"},
    ).json()["id"]

    blocked = client.post(
        f"/api/v1/questions/{qid}/vote",
        headers=_auth(ptoken),
        json={"direction": "down"},
    )
    assert blocked.status_code == 403

    client.patch(
        f"/api/v1/interactions/{interaction_id}",
        headers=headers,
        json={"settings": {"downvote_enabled": True}},
    )
    ok = client.post(
        f"/api/v1/questions/{qid}/vote",
        headers=_auth(ptoken),
        json={"direction": "down"},
    )
    assert ok.status_code == 200
    assert ok.json()["downvote_count"] == 1
    assert ok.json()["score"] == -1


def test_be004_moderate_requires_host_permission(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """BE-004：非該活動 org 的 host 審核回 403。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": True})
    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "他人活動"},
    ).json()["id"]

    other = _second_host(client)
    resp = client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=_auth(other),
        json={"action": "approve"},
    )
    assert resp.status_code == 403


def test_be004_answer_and_highlight_flow(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """BE-004-FR3：核准 → 標記已回答 → 高亮。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id)
    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "現場問題"},
    ).json()["id"]

    answer = client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=headers,
        json={"action": "answer"},
    )
    assert answer.status_code == 200
    assert answer.json()["status"] == "answered"
    assert answer.json()["answered_at"] is not None

    highlight = client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=headers,
        json={"action": "highlight"},
    )
    assert highlight.status_code == 200
    assert highlight.json()["highlighted"] is True


def test_host_reply_appears_in_public_list(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """Host 公開回覆後，參與者列表可見 replies。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": True})

    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "需要回覆的問題"},
    ).json()["id"]
    client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=headers,
        json={"action": "approve"},
    )

    reply_resp = client.post(
        f"/api/v1/questions/{qid}/replies",
        headers=headers,
        json={"content": "謝謝提問，這是我們的回覆。", "is_private": False},
    )
    assert reply_resp.status_code == 201, reply_resp.text

    listed = client.get(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
    )
    assert listed.status_code == 200
    items = listed.json()["items"]
    hit = next(i for i in items if i["id"] == qid)
    assert len(hit["replies"]) == 1
    assert hit["replies"][0]["content"] == "謝謝提問，這是我們的回覆。"


def test_answered_questions_in_public_list(
    client: TestClient, host_token: tuple[str, str]
) -> None:
    """已標記 answered 的問題仍出現在公開列表。"""
    headers = _auth(host_token[0])
    session = _live_session(client, headers)
    ptoken, room_id = _join(client, session["id"])
    _open_qa(client, headers, room_id, settings={"moderation_enabled": False})

    qid = client.post(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
        json={"content": "已答問題"},
    ).json()["id"]
    client.post(
        f"/api/v1/questions/{qid}/moderate",
        headers=headers,
        json={"action": "answer"},
    )

    listed = client.get(
        f"/api/v1/rooms/{room_id}/questions",
        headers=_auth(ptoken),
    )
    ids = [i["id"] for i in listed.json()["items"]]
    assert qid in ids
