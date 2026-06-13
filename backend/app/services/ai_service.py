"""AI 旁路 stub 服務（AI-001~003；10s timeout、503 降級）。"""

from __future__ import annotations

import asyncio
import datetime as dt
import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import AiFeature
from app.models.sprint9 import AiRequestLog
from app.models.user import User
from app.schemas.ai import (
    AiGeneratePollsRequest,
    AiQuestionAssistRequest,
    AiRewriteRequest,
    AiStubResponse,
)

_AI_TIMEOUT_S = 10.0


def _require_ai_key() -> None:
    settings = get_settings()
    if not settings.ai_api_key:
        raise AppError(
            ErrorCode.AI_UNAVAILABLE,
            "AI 服務未設定（缺少 ai_api_key）",
        )


async def _run_with_timeout(coro: Any) -> Any:
    """10 秒 timeout 包裝（鐵律：AI 旁路 timeout）。"""
    return await asyncio.wait_for(coro, timeout=_AI_TIMEOUT_S)


async def _log_request(
    db: AsyncSession,
    *,
    user: User,
    feature: AiFeature,
    status: str,
    latency_ms: int,
    details: dict[str, Any],
) -> None:
    now = dt.datetime.now(dt.UTC)
    db.add(
        AiRequestLog(
            id=uuid7(),
            org_id=user.org_id,
            user_id=user.id,
            feature=feature,
            status=status,
            latency_ms=latency_ms,
            is_ai_generated=True,
            details_jsonb=details,
            created_at=now,
        )
    )
    await db.commit()


async def _stub_llm_call(feature: AiFeature, payload: dict[str, Any]) -> dict[str, Any]:
    """Placeholder：模擬外部 LLM 延遲。"""

    async def _inner() -> dict[str, Any]:
        await asyncio.sleep(0.05)
        if feature == AiFeature.GENERATE_POLLS:
            count = int(payload.get("count", 3))
            return {
                "polls": [
                    {
                        "title": f"（AI stub）關於「{payload.get('topic', '')}」的問題 {i + 1}",
                        "options": ["選項 A", "選項 B", "選項 C"],
                    }
                    for i in range(count)
                ]
            }
        if feature == AiFeature.REWRITE:
            return {"text": f"（AI stub）{payload.get('text', '')}"}
        if feature == AiFeature.QUESTION_ASSIST:
            return {
                "suggestions": [
                    f"（AI stub）延伸：{payload.get('question', '')}",
                ]
            }
        return {"message": "stub"}

    return await _run_with_timeout(_inner())


async def generate_polls(
    db: AsyncSession,
    *,
    user: User,
    payload: AiGeneratePollsRequest,
) -> AiStubResponse:
    """AI-001：依主題產生 Poll 草稿。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _stub_llm_call(
            AiFeature.GENERATE_POLLS,
            {"topic": payload.topic, "count": payload.count, "context": payload.context},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.GENERATE_POLLS,
        status=status,
        latency_ms=latency_ms,
        details={"topic": payload.topic, "count": payload.count},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)


async def rewrite(
    db: AsyncSession,
    *,
    user: User,
    payload: AiRewriteRequest,
) -> AiStubResponse:
    """AI-002：改寫文字。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _stub_llm_call(
            AiFeature.REWRITE,
            {"text": payload.text, "tone": payload.tone},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.REWRITE,
        status=status,
        latency_ms=latency_ms,
        details={"tone": payload.tone},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)


async def question_assist(
    db: AsyncSession,
    *,
    user: User,
    payload: AiQuestionAssistRequest,
) -> AiStubResponse:
    """AI-003：Q&A 提問輔助。"""
    _require_ai_key()
    started = time.perf_counter()
    try:
        result = await _stub_llm_call(
            AiFeature.QUESTION_ASSIST,
            {"question": payload.question, "context": payload.context},
        )
        status = "ok"
    except TimeoutError as exc:
        raise AppError(ErrorCode.AI_UNAVAILABLE, "AI 請求逾時") from exc
    latency_ms = int((time.perf_counter() - started) * 1000)
    await _log_request(
        db,
        user=user,
        feature=AiFeature.QUESTION_ASSIST,
        status=status,
        latency_ms=latency_ms,
        details={"question_len": len(payload.question)},
    )
    return AiStubResponse(result=result, latency_ms=latency_ms)
