"""Quiz API（BE-007、FE-011）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user, get_participant_claims
from app.core.screen_reader_auth import HostOrScreenAuth, get_host_or_screen_auth
from app.core.tokens import ParticipantTokenClaims
from app.models.user import User
from app.schemas.quiz import (
    QuizActionRequest,
    QuizActionResponse,
    QuizAnswerResult,
    QuizAnswerSubmitRequest,
    QuizLeaderboardResponse,
    QuizQuestionCreateRequest,
    QuizQuestionPublic,
    QuizQuestionUpdateRequest,
)
from app.services import quiz_service

router = APIRouter(tags=["quizzes"])


@router.post(
    "/quizzes/{quiz_interaction_id}/questions",
    response_model=QuizQuestionPublic,
    status_code=201,
)
async def add_quiz_question(
    quiz_interaction_id: uuid.UUID,
    payload: QuizQuestionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> QuizQuestionPublic:
    """新增 Quiz 子題。"""
    return await quiz_service.add_question(
        db,
        quiz_interaction_id=quiz_interaction_id,
        host=host,
        payload=payload,
    )


@router.get(
    "/quizzes/{quiz_interaction_id}/questions",
    response_model=list[QuizQuestionPublic],
)
async def list_quiz_questions(
    quiz_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    auth: Annotated[HostOrScreenAuth, Depends(get_host_or_screen_auth)],
) -> list[QuizQuestionPublic]:
    """列出 Quiz 子題（Host／Screen）。"""
    return await quiz_service.list_questions(
        db,
        quiz_interaction_id=quiz_interaction_id,
        host=auth.host,
        screen=auth.screen,
    )


@router.get(
    "/quizzes/{quiz_interaction_id}/active-question",
    response_model=QuizQuestionPublic | None,
)
async def get_active_quiz_question(
    quiz_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> QuizQuestionPublic | None:
    """取得目前可作答的 Quiz 子題（參與者）。"""
    return await quiz_service.get_active_question_for_participant(
        db,
        quiz_interaction_id=quiz_interaction_id,
        participant_id=claims.participant_id,
    )


@router.patch(
    "/quizzes/questions/{question_id}",
    response_model=QuizQuestionPublic,
)
async def update_quiz_question(
    question_id: uuid.UUID,
    payload: QuizQuestionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> QuizQuestionPublic:
    """更新 Quiz 子題（僅 pending）。"""
    return await quiz_service.update_question(
        db, question_id=question_id, host=host, payload=payload
    )


@router.delete("/quizzes/questions/{question_id}", status_code=204)
async def delete_quiz_question(
    question_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> None:
    """刪除 Quiz 子題（僅 pending）。"""
    await quiz_service.delete_question(db, question_id=question_id, host=host)


@router.get(
    "/quizzes/{quiz_interaction_id}/leaderboard",
    response_model=QuizLeaderboardResponse,
)
async def quiz_leaderboard(
    quiz_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    auth: Annotated[HostOrScreenAuth, Depends(get_host_or_screen_auth)],
) -> QuizLeaderboardResponse:
    """Quiz 排行榜（Host／Screen）。"""
    return await quiz_service.get_leaderboard(
        db,
        quiz_interaction_id=quiz_interaction_id,
        host=auth.host,
        screen=auth.screen,
    )


@router.post(
    "/quizzes/questions/{question_id}/actions",
    response_model=QuizActionResponse,
)
async def quiz_action(
    question_id: uuid.UUID,
    payload: QuizActionRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> QuizActionResponse:
    """Quiz 控場動作。"""
    return await quiz_service.quiz_action(
        db, question_id=question_id, host=host, request=payload
    )


@router.post(
    "/quizzes/questions/{question_id}/answers",
    response_model=QuizAnswerResult,
    status_code=201,
)
async def submit_quiz_answer(
    question_id: uuid.UUID,
    payload: QuizAnswerSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> QuizAnswerResult:
    """提交 Quiz 作答。"""
    return await quiz_service.submit_answer(
        db,
        question_id=question_id,
        participant_id=claims.participant_id,
        payload=payload,
    )
