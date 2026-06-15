"""Survey API（BE-006、FE-012）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user, get_participant_claims
from app.core.tokens import ParticipantTokenClaims
from app.models.user import User
from app.schemas.survey import (
    SurveyQuestionCreateRequest,
    SurveyQuestionParticipantPublic,
    SurveyQuestionPublic,
    SurveyResultsResponse,
    SurveySubmissionsResponse,
    SurveySubmitRequest,
    SurveySubmitResult,
)
from app.services import survey_service

router = APIRouter(tags=["surveys"])


@router.get(
    "/surveys/{survey_interaction_id}/questions",
    response_model=list[SurveyQuestionPublic],
)
async def list_survey_questions(
    survey_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> list[SurveyQuestionPublic]:
    """列出 Survey 子題（Host）。"""
    return await survey_service.list_questions(
        db, survey_interaction_id=survey_interaction_id, host=host
    )


@router.get(
    "/surveys/{survey_interaction_id}/participant-questions",
    response_model=list[SurveyQuestionParticipantPublic],
)
async def list_survey_questions_for_participant(
    survey_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> list[SurveyQuestionParticipantPublic]:
    """列出 Survey 子題（參與者作答）。"""
    return await survey_service.list_questions_for_participant(
        db,
        survey_interaction_id=survey_interaction_id,
        participant_id=claims.participant_id,
    )


@router.post(
    "/surveys/{survey_interaction_id}/questions",
    response_model=SurveyQuestionPublic,
    status_code=201,
)
async def add_survey_question(
    survey_interaction_id: uuid.UUID,
    payload: SurveyQuestionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SurveyQuestionPublic:
    """新增 Survey 子題。"""
    return await survey_service.add_question(
        db,
        survey_interaction_id=survey_interaction_id,
        host=host,
        payload=payload,
    )


@router.post(
    "/surveys/{survey_interaction_id}/submit",
    response_model=SurveySubmitResult,
    status_code=201,
)
async def submit_survey(
    survey_interaction_id: uuid.UUID,
    payload: SurveySubmitRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> SurveySubmitResult:
    """提交 Survey 答案。"""
    return await survey_service.submit_survey(
        db,
        survey_interaction_id=survey_interaction_id,
        participant_id=claims.participant_id,
        payload=payload,
    )


@router.get(
    "/surveys/{survey_interaction_id}/results",
    response_model=SurveyResultsResponse,
)
async def survey_results(
    survey_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SurveyResultsResponse:
    """Survey 結果聚合。"""
    return await survey_service.get_results(
        db, survey_interaction_id=survey_interaction_id, host=host
    )


@router.get(
    "/surveys/{survey_interaction_id}/submissions",
    response_model=SurveySubmissionsResponse,
)
async def survey_submissions(
    survey_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SurveySubmissionsResponse:
    """Survey 逐人完整作答（Host 工作台）。"""
    return await survey_service.list_submissions_for_host(
        db, survey_interaction_id=survey_interaction_id, host=host
    )
