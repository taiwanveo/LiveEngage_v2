"""Poll API（FE-006~010、BE-003/005；SDS §5.3）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import bearer_scheme, get_current_user, get_participant_claims
from app.core.errors import AppError, ErrorCode
from app.core.tokens import (
    ParticipantTokenClaims,
    decode_access_token,
    decode_participant_token,
)
from app.models.user import User
from app.schemas.poll import (
    PollActionRequest,
    PollActionResponse,
    PollDetail,
    PollOptionPublic,
    PollOptionsUpdateRequest,
    PollResults,
    PollSubmitRequest,
    PollSubmitResult,
)
from app.services import poll_service

router = APIRouter(tags=["polls"])


@dataclass(frozen=True, slots=True)
class PollViewer:
    """Poll 讀取端身分（Host 或 Participant）。"""

    viewer_id: uuid.UUID
    is_host: bool


def _parse_idempotency_key(raw: str | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError as exc:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "Idempotency-Key 須為有效 UUID"
        ) from exc


async def get_poll_viewer(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> PollViewer:
    """解析 Bearer：participant token 優先，否則 host access token。"""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少或無效的 Authorization")

    token = credentials.credentials
    try:
        participant_claims = decode_participant_token(token)
        return PollViewer(viewer_id=participant_claims.participant_id, is_host=False)
    except AppError:
        pass

    access_claims = decode_access_token(token)
    return PollViewer(viewer_id=access_claims.user_id, is_host=True)


@router.get("/polls/{interaction_id}", response_model=PollDetail)
async def get_poll(
    interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    viewer: Annotated[PollViewer, Depends(get_poll_viewer)],
) -> PollDetail:
    """題目內容 + 個人作答狀態（揭示前不含正解）。"""
    return await poll_service.get_poll_detail(
        db,
        interaction_id,
        viewer_id=viewer.viewer_id,
        is_host=viewer.is_host,
    )


@router.post(
    "/polls/{interaction_id}/responses",
    response_model=PollSubmitResult,
    status_code=201,
)
async def submit_poll_response(
    interaction_id: uuid.UUID,
    payload: PollSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
) -> PollSubmitResult:
    """提交作答（Idempotency-Key、rate limit 10/min）。"""
    return await poll_service.submit_poll_response(
        db,
        interaction_id=interaction_id,
        participant_id=claims.participant_id,
        payload=payload,
        idempotency_key=_parse_idempotency_key(idempotency_key),
    )


@router.get("/polls/{interaction_id}/results", response_model=PollResults)
async def get_poll_results(
    interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    viewer: Annotated[PollViewer, Depends(get_poll_viewer)],
) -> PollResults:
    """結果聚合（後端絕對值；participant 受 result_visible 控制）。"""
    return await poll_service.get_poll_results(
        db, interaction_id, is_host=viewer.is_host
    )


@router.post("/polls/{interaction_id}/actions", response_model=PollActionResponse)
async def poll_action(
    interaction_id: uuid.UUID,
    payload: PollActionRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> PollActionResponse:
    """控場動作（start/stop/lock/unlock/reveal/hide/reset）。"""
    return await poll_service.execute_poll_action(
        db, interaction_id, host, payload
    )


@router.put(
    "/polls/{interaction_id}/options",
    response_model=list[PollOptionPublic],
)
async def update_poll_options(
    interaction_id: uuid.UUID,
    payload: PollOptionsUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> list[PollOptionPublic]:
    """取代 Poll 全部選項（BE-003 Builder）。"""
    return await poll_service.upsert_poll_options(
        db,
        interaction_id,
        host,
        [opt.model_dump() for opt in payload.options],
    )
