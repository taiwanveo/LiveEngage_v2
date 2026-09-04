"""AI 旁路 API（AI-001~003 stub）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ai import (
    AiConfigOverride,
    AiGeneratePollsRequest,
    AiGeneratePollsResponse,
    AiQuestionAssistRequest,
    AiRewriteRequest,
    AiStubResponse,
    AiTestConnectionRequest,
    AiTestConnectionResponse,
    AiModelsRequest,
    AiModelsResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ai_override(request: Request) -> AiConfigOverride | None:
    """從 HTTP Headers 萃取自訂 AI 設定。"""
    api_key = request.headers.get("x-ai-api-key")
    if not api_key or not api_key.strip():
        return None
    return AiConfigOverride(
        api_key=api_key.strip(),
        provider=request.headers.get("x-ai-provider", "auto").strip() or "auto",
        model=request.headers.get("x-ai-model", "").strip(),
        base_url=request.headers.get("x-ai-base-url", "").strip(),
    )


@router.post("/test-connection", response_model=AiTestConnectionResponse)
async def test_connection(
    request: Request,
    payload: AiTestConnectionRequest | None = None,
) -> AiTestConnectionResponse:
    """測試 LLM 連線與 API Key 有效性（支援由 Body 或 Header 傳入自訂 Key 進行驗證）。"""
    ai_override: AiConfigOverride | None = None
    if payload and payload.api_key:
        ai_override = AiConfigOverride(
            api_key=payload.api_key.strip(),
            provider=payload.provider.strip() or "auto",
            model=payload.model.strip(),
            base_url=payload.base_url.strip(),
        )
    else:
        ai_override = get_ai_override(request)

    res = await ai_service.test_ai_connection(ai_override=ai_override)
    return AiTestConnectionResponse(
        status=res.get("status", "ok"),
        message=res.get("message", "連線測試完成"),
        provider=res.get("provider", ""),
        model=res.get("model", ""),
        suggested_model=res.get("suggested_model"),
        latency_ms=res.get("latency_ms", 0),
        models=res.get("models", []),
    )


@router.post("/models", response_model=AiModelsResponse)
async def list_ai_models(
    request: Request,
    payload: AiModelsRequest | None = None,
) -> AiModelsResponse:
    """獲取指定 Provider 的可用文字處理模型清單（過濾純生圖、音訊等不適用模型）。"""
    ai_override: AiConfigOverride | None = None
    if payload and (payload.api_key or payload.base_url or payload.provider != "auto"):
        ai_override = AiConfigOverride(
            api_key=payload.api_key.strip(),
            provider=payload.provider.strip() or "auto",
            model="",
            base_url=payload.base_url.strip(),
        )
    else:
        ai_override = get_ai_override(request)

    res = await ai_service.fetch_ai_models(ai_override=ai_override)
    return AiModelsResponse(
        status=res.get("status", "ok"),
        message=res.get("message", "模型清單獲取完成"),
        provider=res.get("provider", ""),
        models=res.get("models", []),
    )


@router.post("/generate-polls", response_model=AiGeneratePollsResponse)
async def generate_polls(
    payload: AiGeneratePollsRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
    request: Request,
) -> AiGeneratePollsResponse:
    """AI-001：依主題產生 Poll 草稿（支援自訂金鑰注入與離線降級）。"""
    ai_override = get_ai_override(request)
    return await ai_service.generate_polls(
        db, user=user, payload=payload, ai_override=ai_override
    )


@router.post("/rewrite", response_model=AiStubResponse)
async def rewrite_text(
    payload: AiRewriteRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> AiStubResponse:
    """AI-002：改寫文字。"""
    return await ai_service.rewrite(db, user=user, payload=payload)


@router.post("/question-assist", response_model=AiStubResponse)
async def question_assist(
    payload: AiQuestionAssistRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> AiStubResponse:
    """AI-003：Q&A 提問輔助。"""
    return await ai_service.question_assist(db, user=user, payload=payload)
