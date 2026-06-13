"""Ideas Board API（FE-013）。"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import bearer_scheme, get_current_user, get_participant_claims
from app.core.tokens import ParticipantTokenClaims
from app.core.errors import AppError, ErrorCode
from app.core.tokens import decode_access_token, decode_participant_token
from app.models.user import User
from app.schemas.ideas import (
    IdeaListResponse,
    IdeaPublic,
    IdeaReactRequest,
    IdeaSort,
    IdeaSubmitRequest,
)
from app.services import ideas_service

router = APIRouter(tags=["ideas"])


@dataclass(frozen=True, slots=True)
class IdeasViewer:
    participant_id: uuid.UUID | None
    is_host: bool


async def get_ideas_viewer(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
) -> IdeasViewer:
    if credentials is None or credentials.scheme.lower() != "bearer":
        return IdeasViewer(participant_id=None, is_host=False)
    token = credentials.credentials
    try:
        claims = decode_participant_token(token)
        return IdeasViewer(participant_id=claims.participant_id, is_host=False)
    except AppError:
        decode_access_token(token)
        return IdeasViewer(participant_id=None, is_host=True)


@router.post(
    "/ideas-boards/{board_interaction_id}/ideas",
    response_model=IdeaPublic,
    status_code=201,
)
async def submit_idea(
    board_interaction_id: uuid.UUID,
    payload: IdeaSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> IdeaPublic:
    """提交點子。"""
    return await ideas_service.submit_idea(
        db,
        board_interaction_id=board_interaction_id,
        claims=claims,
        payload=payload,
    )


@router.get(
    "/ideas-boards/{board_interaction_id}/ideas",
    response_model=IdeaListResponse,
)
async def list_ideas(
    board_interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    viewer: Annotated[IdeasViewer, Depends(get_ideas_viewer)],
    sort: IdeaSort = Query(IdeaSort.NEWEST),
) -> IdeaListResponse:
    """列出點子。"""
    return await ideas_service.list_ideas(
        db,
        board_interaction_id=board_interaction_id,
        sort=sort,
        participant_id=viewer.participant_id,
        is_host=viewer.is_host,
    )


@router.post("/ideas/{idea_id}/react", response_model=IdeaPublic)
async def react_idea(
    idea_id: uuid.UUID,
    payload: IdeaReactRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    claims: Annotated[ParticipantTokenClaims, Depends(get_participant_claims)],
) -> IdeaPublic:
    """Emoji 反應切換。"""
    return await ideas_service.react(
        db, idea_id=idea_id, claims=claims, payload=payload
    )


@router.post("/ideas/{idea_id}/hide", response_model=IdeaPublic)
async def hide_idea(
    idea_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> IdeaPublic:
    """Host 隱藏點子。"""
    return await ideas_service.hide_idea(db, idea_id=idea_id, host=host)
