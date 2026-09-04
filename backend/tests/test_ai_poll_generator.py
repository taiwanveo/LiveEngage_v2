"""測試 AI 一鍵靈感出題（AI-001 題目生成、多題型支援、離線情境模板、批次建立）。"""

from app.schemas.ai import AiGeneratedPollItem, AiGeneratePollsResponse
from app.services.ai_service import generate_polls_local


def test_generate_polls_local_tech_scenario():
    polls = generate_polls_local(topic="微服務架構重構與效能優化", count=3)
    assert len(polls) == 3
    assert any(p["type"] == "multiple_choice" for p in polls)
    mc = next(p for p in polls if p["type"] == "multiple_choice")
    assert len(mc["options"]) >= 3
    assert "瓶頸" in mc["title"] or "架構" in mc["title"]
    assert len(mc["rationality"]) > 0


def test_generate_polls_local_icebreaker():
    polls = generate_polls_local(topic="今天團隊破冰與暖場活動", count=3)
    assert len(polls) == 3
    titles = [p["title"] for p in polls]
    assert any("電量" in t or "超能力" in t or "期待" in t for t in titles)


def test_generate_polls_local_filtered_type():
    wc_polls = generate_polls_local(topic="未來趨勢展望", count=2, poll_type="word_cloud")
    assert len(wc_polls) == 2
    for p in wc_polls:
        assert p["type"] == "word_cloud"
        assert p["options"] == []


def test_generate_polls_response_schema():
    items = [
        AiGeneratedPollItem(
            title="你對新版滿意度？",
            type="rating",
            description="請給予 1-5 星",
            options=[],
            rationality="評估滿意度",
        ),
        AiGeneratedPollItem(
            title="首要推動方向？",
            type="multiple_choice",
            options=["選項 A", "選項 B", "選項 C"],
            rationality="決策選擇",
        ),
    ]
    resp = AiGeneratePollsResponse(
        polls=items,
        result={"polls": [i.model_dump() for i in items]},
        latency_ms=45,
    )
    dumped = resp.model_dump()
    assert len(dumped["polls"]) == 2
    assert dumped["polls"][0]["type"] == "rating"
    assert dumped["polls"][1]["type"] == "multiple_choice"
    assert len(dumped["polls"][1]["options"]) == 3


def test_batch_create_interactions_endpoint(client, host_token):
    """驗證批次建立題目（含選擇題選項）正常寫入資料庫且不拋 500。"""
    token, _ = host_token
    headers = {"Authorization": f"Bearer {token}"}
    create_s = client.post("/api/v1/sessions", headers=headers, json={"title": "AI 批次出題測試"})
    assert create_s.status_code == 201
    room_id = create_s.json()["default_room_id"]

    batch_payload = {
        "polls": [
            {
                "title": "最重要重構目標？",
                "type": "multiple_choice",
                "options": ["API 延遲", "資料庫連線池", "打包體積"],
                "settings": {},
            },
            {
                "title": "用一個詞代表感想？",
                "type": "word_cloud",
                "options": [],
                "settings": {},
            },
            {
                "title": "滿意度評分？",
                "type": "rating",
                "options": [],
                "settings": {},
            },
        ]
    }
    resp = client.post(
        f"/api/v1/rooms/{room_id}/interactions/batch",
        headers=headers,
        json=batch_payload,
    )
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert len(created) == 3
    assert created[0]["title"] == "最重要重構目標？"
    assert created[0]["type"] == "multiple_choice"

    # 確認選項是否成功寫入
    options_resp = client.get(f"/api/v1/polls/{created[0]['id']}", headers=headers)
    assert options_resp.status_code == 200
    assert len(options_resp.json()["options"]) == 3

