"""AI 旁路請求／回應 schema（AI-001~003）。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AiGeneratePollsRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    count: int = Field(default=3, ge=1, le=10)
    context: str | None = None


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
