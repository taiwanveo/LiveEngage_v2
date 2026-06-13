"""AI 旁路 API（AI-001~003 stub）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ai import (
    AiGeneratePollsRequest,
    AiQuestionAssistRequest,
    AiRewriteRequest,
    AiStubResponse,
)
from app.services import ai_service

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/generate-polls", response_model=AiStubResponse)
async def generate_polls(
    payload: AiGeneratePollsRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> AiStubResponse:
    """AI-001：依主題產生 Poll 草稿。"""
    return await ai_service.generate_polls(db, user=user, payload=payload)


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
