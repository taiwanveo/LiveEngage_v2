"""測試 AI 一鍵靈感出題（AI-001 題目生成、多題型支援、離線情境模板、批次建立）。"""

import pytest
from app.schemas.ai import AiGeneratedPollItem, AiGeneratePollsRequest, AiGeneratePollsResponse
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
