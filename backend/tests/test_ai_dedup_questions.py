"""測試 AI Q&A 語意去重與同義題合併（AI-002 離線分群、多領域同義歸一、票數聚合、Schema 驗證）。"""

import pytest
from app.schemas.ai import (
    AiDedupQuestionsResponse,
    AiQuestionCluster,
    AiQuestionItem,
    MergeQuestionsRequest,
    MergeQuestionsResponse,
    UnmergeQuestionResponse,
)
from app.services.ai_service import dedup_questions_local
import uuid


def test_dedup_questions_local_empty_and_single():
    assert dedup_questions_local([]) == []
    single = [{"id": "q1", "content": "單一問題", "upvote_count": 1}]
    assert dedup_questions_local(single) == []


def test_dedup_questions_local_slides_scenario():
    questions = [
        {
            "id": "q1",
            "content": "請問今天演講的投影片會公開嗎？",
            "author_display": "Alex",
            "upvote_count": 10,
            "status": "approved",
        },
        {
            "id": "q2",
            "content": "會後會提供講義或簡報檔案下載嗎？",
            "author_display": "Bob",
            "upvote_count": 6,
            "status": "approved",
        },
        {
            "id": "q3",
            "content": "簡報檔可以分享嗎？",
            "author_display": "Carol",
            "upvote_count": 4,
            "status": "approved",
        },
    ]

    clusters = dedup_questions_local(questions)
    assert len(clusters) == 1
    c = clusters[0]
    # 最高票為 q1 (10 票)
    assert c["primary_question"]["id"] == "q1"
    # 其他兩題為重複題
    dup_ids = [d["id"] for d in c["duplicate_questions"]]
    assert "q2" in dup_ids
    assert "q3" in dup_ids
    assert len(dup_ids) == 2
    # 票數聚合：10 + 6 + 4 = 20
    assert c["combined_upvotes"] == 20
    assert "簡報" in c["similarity_reason"] or "投影片" in c["similarity_reason"]


def test_dedup_questions_local_multiple_distinct_clusters():
    questions = [
        # 簡報組
        {"id": "q1", "content": "請問今天簡報會後會提供嗎？", "upvote_count": 8},
        {"id": "q2", "content": "投影片檔案哪裡可以下載？", "upvote_count": 3},
        # 錄影組
        {"id": "q3", "content": "請問這場研討會有錄影嗎？", "upvote_count": 5},
        {"id": "q4", "content": "會後會有影音回放連結可以看嗎？", "upvote_count": 7},
        # 無關單一題
        {"id": "q5", "content": "今天會場冷氣有點冷能不能調高？", "upvote_count": 1},
    ]

    clusters = dedup_questions_local(questions)
    assert len(clusters) == 2

    # 一組簡報，一組錄影
    reasons = [c["similarity_reason"] for c in clusters]
    assert any("簡報" in r or "投影片" in r for r in reasons)
    assert any("錄影" in r or "回放" in r for r in reasons)

    # 驗證錄影組以 q4 (7 票) 為主題
    rec_cluster = next(c for c in clusters if "錄影" in c["similarity_reason"] or "回放" in c["similarity_reason"])
    assert rec_cluster["primary_question"]["id"] == "q4"
    assert rec_cluster["combined_upvotes"] == 12


def test_dedup_questions_local_unrelated_no_false_positives():
    questions = [
        {"id": "q1", "content": "明天活動幾點開始？", "upvote_count": 1},
        {"id": "q2", "content": "現場有提供素食餐盒嗎？", "upvote_count": 2},
        {"id": "q3", "content": "WiFi 密碼是多少？", "upvote_count": 5},
    ]
    clusters = dedup_questions_local(questions)
    assert len(clusters) == 0


def test_dedup_questions_schemas():
    p_id = uuid.uuid4()
    d_id = uuid.uuid4()

    req = MergeQuestionsRequest(
        primary_question_id=p_id,
        duplicate_question_ids=[d_id],
    )
    assert req.primary_question_id == p_id
    assert len(req.duplicate_question_ids) == 1

    resp = MergeQuestionsResponse(
        primary_question_id=p_id,
        merged_question_ids=[d_id],
        new_upvote_count=15,
        new_score=15,
        total_upvotes_added=5,
        is_manual=True,
        message="成功手動合併同義提問",
    )
    assert resp.total_upvotes_added == 5
    assert resp.is_manual is True


def test_unmerge_question_schema():
    p_id = uuid.uuid4()
    u_id = uuid.uuid4()
    resp = UnmergeQuestionResponse(
        unmerged_question_id=u_id,
        primary_question_id=p_id,
        primary_new_upvote_count=10,
        message="成功解除合併",
    )
    assert resp.unmerged_question_id == u_id
    assert resp.primary_question_id == p_id
    assert resp.primary_new_upvote_count == 10
