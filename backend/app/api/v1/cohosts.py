"""Co-host API（BE-012）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.cohost import (
    CohostInviteRequest,
    CohostListResponse,
    CohostPermissionsUpdateRequest,
    CohostPublic,
)
from app.services import cohost_service

router = APIRouter(tags=["cohosts"])


@router.post(
    "/sessions/{session_id}/cohosts",
    response_model=CohostPublic,
    status_code=201,
)
async def invite_cohost(
    session_id: uuid.UUID,
    payload: CohostInviteRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> CohostPublic:
    """邀請 co-host。"""
    return await cohost_service.invite(
        db, session_id=session_id, host=host, payload=payload
    )


@router.get(
    "/sessions/{session_id}/cohosts",
    response_model=CohostListResponse,
)
async def list_cohosts(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> CohostListResponse:
    """列出 co-host。"""
    return await cohost_service.list_cohosts(
        db, session_id=session_id, host=host
    )


@router.patch(
    "/sessions/{session_id}/cohosts/{cohost_id}",
    response_model=CohostPublic,
)
async def update_cohost_permissions(
    session_id: uuid.UUID,
    cohost_id: uuid.UUID,
    payload: CohostPermissionsUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> CohostPublic:
    """更新 co-host 權限。"""
    return await cohost_service.update_permissions(
        db,
        session_id=session_id,
        cohost_id=cohost_id,
        host=host,
        payload=payload,
    )


@router.delete(
    "/sessions/{session_id}/cohosts/{cohost_id}",
    response_model=CohostPublic,
)
async def revoke_cohost(
    session_id: uuid.UUID,
    cohost_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> CohostPublic:
    """撤銷 co-host。"""
    return await cohost_service.revoke(
        db, session_id=session_id, cohost_id=cohost_id, host=host
    )
