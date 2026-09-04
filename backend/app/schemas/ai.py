"""AI 旁路請求／回應 schema（AI-001~003）。"""

from __future__ import annotations

from typing import Any
import uuid

from pydantic import BaseModel, Field


class AiGeneratedPollItem(BaseModel):
    """AI 生成的單一投票題目草稿。"""

    title: str
    type: str = "multiple_choice"  # multiple_choice, word_cloud, rating, open_text, ranking
    description: str = ""
    options: list[str] = Field(default_factory=list)
    settings: dict[str, Any] = Field(default_factory=dict)
    rationality: str = ""


class AiGeneratePollsRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    count: int = Field(default=3, ge=1, le=10)
    context: str | None = None
    poll_type: str | None = None  # "mixed", "multiple_choice", "word_cloud", "rating", "open_text", "ranking"


class AiGeneratePollsResponse(BaseModel):
    """AI 產生題目的結構化回應。"""

    polls: list[AiGeneratedPollItem]
    result: dict[str, Any] = Field(default_factory=dict)
    is_ai_generated: bool = True
    latency_ms: int


class AiRewriteRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    tone: str = Field(default="professional", max_length=50)


class AiQuestionAssistRequest(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    context: str | None = None


class AiStubResponse(BaseModel):
    result: dict[str, Any]
    is_ai_generated: bool = True
    latency_ms: int


# ── AI 決策報告 Schema（會後一鍵高階洞察報告）───────────────────────


class DecisionConsensus(BaseModel):
    """關鍵共識：全場高度支持之意見與數據佐證。"""

    title: str
    evidence: str
    impact: str


class DecisionDivergence(BaseModel):
    """主要分歧：意見對立、票數接近或需進一步對齊之議題。"""

    topic: str
    description: str
    suggested_compromise: str


class UnansweredTopQuestion(BaseModel):
    """未解答高關注問題：觀眾熱烈按讚但會中未能回答之焦點。"""

    question: str
    upvotes: int
    why_important: str
    suggested_response_direction: str


class ActionRecommendation(BaseModel):
    """建議行動清單：具體後續追蹤指引。"""

    owner: str
    action: str
    priority: str = "high"  # high, medium, low
    timeline: str


class AiDecisionReport(BaseModel):
    """會後 AI 決策報告完整內容。"""

    session_id: str
    session_title: str
    generated_at: str
    executive_summary: str
    engagement_rating: str
    key_metrics: dict[str, Any]
    key_consensuses: list[DecisionConsensus]
    divergences: list[DecisionDivergence]
    unanswered_concerns: list[UnansweredTopQuestion]
    action_recommendations: list[ActionRecommendation]
    markdown_content: str


class GenerateAiReportRequest(BaseModel):
    """生成 AI 決策報告之請求參數。"""

    force_refresh: bool = False


# ── AI Q&A 語意去重與同義題合併 Schema（AI-002）────────────────────


class AiQuestionItem(BaseModel):
    id: str
    content: str
    author_display: str | None = None
    is_anonymous: bool = False
    upvote_count: int = 0
    status: str = "approved"
    created_at: str | None = None


class AiQuestionCluster(BaseModel):
    cluster_id: str
    primary_question: AiQuestionItem
    duplicate_questions: list[AiQuestionItem]
    combined_upvotes: int
    similarity_reason: str


class AiDedupQuestionsResponse(BaseModel):
    clusters: list[AiQuestionCluster]
    total_duplicates_found: int
    is_ai_generated: bool = True
    latency_ms: int = 0


class MergeQuestionsRequest(BaseModel):
    primary_question_id: uuid.UUID
    duplicate_question_ids: list[uuid.UUID] = Field(..., min_length=1)


class MergeQuestionsResponse(BaseModel):
    primary_question_id: uuid.UUID
    merged_question_ids: list[uuid.UUID]
    new_upvote_count: int
    new_score: int
    total_upvotes_added: int
    message: str


