"""測試 AI 會後決策報告（離線降級、指標綜合、分歧與共識萃取、HTML 渲染）。"""

import pytest

from app.schemas.ai import (
    ActionRecommendation,
    AiDecisionReport,
    DecisionConsensus,
    DecisionDivergence,
    UnansweredTopQuestion,
)
from app.services.ai_service import generate_decision_report_local, render_report_html


def test_generate_decision_report_local_full_data():
    sample_data = {
        "session": {
            "id": "01a06ae7-74f8-76c8-8236-e2f746d1166f",
            "title": "2026 Q3 產品戰略與架構共識會",
            "code": "889900",
            "status": "ended",
            "description": "全員對齊 Q3 核心重點",
        },
        "engagement": {
            "participant_count": 50,
            "participants_engaged": 42,
            "engaged_percent": 84,
            "qa_questions_total": 15,
            "poll_votes_total": 98,
        },
        "polls": [
            {
                "id": "poll-1",
                "title": "下半年度首要重構目標？",
                "type": "multiple_choice",
                "response_count": 45,
                "options": [
                    {"text": "微服務架構遷移", "count": 28},
                    {"text": "前端效能優化", "count": 17},
                ],
            },
            {
                "id": "poll-2",
                "title": "你對目前團隊協作滿意度評分？",
                "type": "rating",
                "response_count": 40,
                "rating_average": 4.2,
            },
            {
                "id": "poll-3",
                "title": "最大的挑戰是什麼？",
                "type": "word_cloud",
                "word_counts": [
                    {
                        "word": "生成式 AI 與工具",
                        "count": 18,
                        "variants": [{"word": "ChatGPT", "count": 10}, {"word": "AI工具", "count": 8}],
                    }
                ],
            },
        ],
        "questions": {
            "total": 5,
            "top_upvoted": [
                {
                    "id": "q-1",
                    "content": "但是時程如果只有兩個月，人力如何兼顧？",
                    "score": 12,
                    "upvotes": 12,
                    "is_answered": False,
                },
                {
                    "id": "q-2",
                    "content": "架構遷移後現有資料庫需要停機維護多久？",
                    "score": 8,
                    "upvotes": 8,
                    "is_answered": True,
                },
            ],
            "unanswered": [
                {
                    "id": "q-1",
                    "content": "但是時程如果只有兩個月，人力如何兼顧？",
                    "score": 12,
                    "upvotes": 12,
                    "is_answered": False,
                }
            ],
            "answered_count": 4,
        },
        "ideas": [
            {"content": "建立跨組 Code Review 機制", "category": "流程優化"}
        ],
    }

    report_dict = generate_decision_report_local(sample_data)

    # 驗證 Schema 可正確驗證
    report = AiDecisionReport.model_validate(report_dict)

    assert report.session_id == "01a06ae7-74f8-76c8-8236-e2f746d1166f"
    assert report.session_title == "2026 Q3 產品戰略與架構共識會"
    assert "84%" in report.engagement_rating
    assert report.key_metrics["participant_count"] == 50
    assert report.key_metrics["participants_engaged"] == 42
    assert report.key_metrics["engaged_percent"] == 84

    # 驗證關鍵共識
    assert len(report.key_consensuses) >= 2
    assert any("微服務架構遷移" in c.title or "微服務架構遷移" in c.evidence for c in report.key_consensuses)
    assert any("生成式 AI" in c.title or "生成式 AI" in c.evidence for c in report.key_consensuses)

    # 驗證分歧或拉鋸
    assert len(report.divergences) >= 1

    # 驗證未解提問
    assert len(report.unanswered_concerns) == 1
    assert "時程如果只有兩個月" in report.unanswered_concerns[0].question
    assert report.unanswered_concerns[0].upvotes == 12

    # 驗證行動建議
    assert len(report.action_recommendations) >= 3

    # 驗證 Markdown 內容生成
    assert "# 📊 【AI 決策報告】" in report.markdown_content
    assert "## 📈 會議互動指標" in report.markdown_content
    assert "## 🎯 執行摘要" in report.markdown_content
    assert "## 🚀 建議行動追蹤清單" in report.markdown_content


def test_generate_decision_report_local_empty_data():
    empty_data = {
        "session": {"id": "empty-id", "title": "測試空白會議", "code": "000000"},
        "engagement": {"participant_count": 0, "participants_engaged": 0, "engaged_percent": 0},
        "polls": [],
        "questions": {"total": 0, "top_upvoted": [], "unanswered": [], "answered_count": 0},
        "ideas": [],
    }

    report_dict = generate_decision_report_local(empty_data)
    report = AiDecisionReport.model_validate(report_dict)

    assert report.session_title == "測試空白會議"
    assert len(report.key_consensuses) >= 1
    assert len(report.divergences) >= 1
    assert len(report.action_recommendations) >= 1
    assert isinstance(report.markdown_content, str) and len(report.markdown_content) > 50


def test_render_report_html():
    report = AiDecisionReport(
        session_id="sess-123",
        session_title="年度戰略發布會",
        generated_at="2026-09-04 18:30 UTC",
        executive_summary="全體同仁對新財年三大戰略方向形成堅實共識。",
        engagement_rating="卓越 (92%)",
        key_metrics={
            "participant_count": 120,
            "participants_engaged": 110,
            "engaged_percent": 92,
            "poll_votes_total": 350,
            "qa_questions_total": 28,
            "answered_count": 25,
        },
        key_consensuses=[
            DecisionConsensus(
                title="聚焦核心客群轉型",
                evidence="獲 88 票支持（73%）",
                impact="做為下半年首要推展重點",
            )
        ],
        divergences=[
            DecisionDivergence(
                topic="上線節奏快慢之爭",
                description="市場端期待 Q3 上線，研發端建議 Q4",
                suggested_compromise="採取雙階段灰度測試",
            )
        ],
        unanswered_concerns=[
            UnansweredTopQuestion(
                question="預算是否足夠支撐雙軌推行？",
                upvotes=15,
                why_important="關乎資源配置底線",
                suggested_response_direction="由財務長出具預算編列說明",
            )
        ],
        action_recommendations=[
            ActionRecommendation(
                owner="專案總監",
                action="建立專案委員會並於本週五召開啟動會",
                priority="high",
                timeline="本週五前",
            )
        ],
        markdown_content="# 決策報告內容",
    )

    html_out = render_report_html(report)
    assert "<!DOCTYPE html>" in html_out
    assert "年度戰略發布會" in html_out
    assert "聚焦核心客群轉型" in html_out
    assert "上線節奏快慢之爭" in html_out
    assert "預算是否足夠支撐雙軌推行？" in html_out
    assert "window.print()" in html_out
    assert "copyMarkdown()" in html_out
