"""Q&A API（FE-004／FE-005、BE-004）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import (
    get_current_user,
    get_optional_participant_claims,
    get_participant_claims,
)
from app.core.tokens import ParticipantTokenClaims
from app.models.enums import QuestionStatus
from app.models.user import User
from app.schemas.ai import (
    AiDedupQuestionsResponse,
    MergeQuestionsRequest,
    MergeQuestionsResponse,
    UnmergeQuestionResponse,
)
from app.schemas.question import (
    ModerateRequest,
    QuestionCreateRequest,
    QuestionListResponse,
    QuestionPublic,
    QuestionSort,
    ReplyCreateRequest,
    ReplyResponse,
    VoteRequest,
    VoteResult,
)
from app.services import qa_service

router = APIRouter(tags=["qa"])


@router.post(
    "/rooms/{room_id}/questions",
    response_model=QuestionPublic,
    status_code=201,
)
async def submit_question(
    room_id: uuid.UUID,
    payload: QuestionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> QuestionPublic:
    """提交問題（FE-004）。"""
    return await qa_service.submit_question(
        db, room_id=room_id, claims=claims, payload=payload
    )


@router.get("/rooms/{room_id}/questions", response_model=QuestionListResponse)
async def list_questions(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[
        ParticipantTokenClaims | None, Depends(get_optional_participant_claims)
    ],
    sort: QuestionSort = Query(QuestionSort.TOP),
    cursor: str | None = Query(None),
) -> QuestionListResponse:
    """公開問題列表（FE-005-FR1）。"""
    return await qa_service.list_public_questions(
        db,
        room_id=room_id,
        sort=sort.value,
        cursor=cursor,
        participant_id=claims.participant_id if claims else None,
    )


@router.post("/questions/{question_id}/vote", response_model=VoteResult)
async def vote_question(
    question_id: uuid.UUID,
    payload: VoteRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> VoteResult:
    """upvote／downvote（FE-005-FR2/FR3）。"""
    return await qa_service.vote_question(
        db, question_id=question_id, claims=claims, direction=payload.direction
    )


@router.get(
    "/rooms/{room_id}/questions/moderation",
    response_model=list[QuestionPublic],
)
async def list_moderation(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
    status: QuestionStatus | None = Query(None),
) -> list[QuestionPublic]:
    """審核清單（BE-004-FR2）。"""
    return await qa_service.list_moderation(
        db, room_id=room_id, host=host, status=status
    )


@router.post("/questions/{question_id}/moderate", response_model=QuestionPublic)
async def moderate_question(
    question_id: uuid.UUID,
    payload: ModerateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> QuestionPublic:
    """審核／現場動作（BE-004-FR2/FR3）。"""
    return await qa_service.moderate_question(
        db, question_id=question_id, host=host, action=payload.action
    )


@router.post(
    "/questions/{question_id}/replies",
    response_model=ReplyResponse,
    status_code=201,
)
async def reply_question(
    question_id: uuid.UUID,
    payload: ReplyCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> ReplyResponse:
    """Host 回覆問題（BE-004-FR3）。"""
    return await qa_service.reply_question(
        db, question_id=question_id, host=host, payload=payload
    )


@router.post(
    "/rooms/{room_id}/questions/ai-dedup",
    response_model=AiDedupQuestionsResponse,
)
async def dedup_room_questions(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
    request: Request,
) -> AiDedupQuestionsResponse:
    """AI-002：掃描房間提問，進行語意去重與同義題目分群。"""
    from app.api.v1.ai import get_ai_override

    ai_override = get_ai_override(request)
    return await qa_service.dedup_room_questions(
        db, room_id=room_id, host=host, ai_override=ai_override
    )


@router.post(
    "/rooms/{room_id}/questions/merge",
    response_model=MergeQuestionsResponse,
)
async def merge_duplicate_questions(
    room_id: uuid.UUID,
    payload: MergeQuestionsRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> MergeQuestionsResponse:
    """AI-002：將同義題目合併至主提問，並聚合累積所有重複提問之讚數。"""
    return await qa_service.merge_duplicate_questions(
        db, room_id=room_id, host=host, payload=payload
    )


@router.post(
    "/rooms/{room_id}/questions/{question_id}/unmerge",
    response_model=UnmergeQuestionResponse,
)
async def unmerge_question(
    room_id: uuid.UUID,
    question_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> UnmergeQuestionResponse:
    """AI-002：將被合併的題目解除合併（還原為獨立題目）。"""
    return await qa_service.unmerge_question(
        db, room_id=room_id, host=host, question_id=question_id
    )

