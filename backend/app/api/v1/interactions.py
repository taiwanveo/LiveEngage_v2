"""互動項目 API（BE-002 子集；本 Sprint 供 Q&A 控場）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.interaction import (
    InteractionCreateRequest,
    InteractionResponse,
    InteractionReorderRequest,
    InteractionUpdateRequest,
)
from app.services import interaction_service

router = APIRouter(tags=["interactions"])


@router.get(
    "/rooms/{room_id}/interactions",
    response_model=list[InteractionResponse],
)
async def list_interactions(
    room_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> list[InteractionResponse]:
    """列出房間內互動項目（Host Builder / 控制台）。"""
    return await interaction_service.list_room_interactions(
        db, room_id=room_id, host=host
    )


@router.post(
    "/rooms/{room_id}/interactions",
    response_model=InteractionResponse,
    status_code=201,
)
async def create_interaction(
    room_id: uuid.UUID,
    payload: InteractionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> InteractionResponse:
    """建立互動項目（BE-002）。"""
    return await interaction_service.create_interaction(
        db, room_id=room_id, host=host, payload=payload
    )


@router.patch("/interactions/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(
    interaction_id: uuid.UUID,
    payload: InteractionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> InteractionResponse:
    """更新互動項目（開關 Q&A、切換審核等）。"""
    return await interaction_service.update_interaction(
        db, interaction_id=interaction_id, host=host, payload=payload
    )


@router.put(
    "/rooms/{room_id}/interactions/reorder",
    response_model=list[InteractionResponse],
)
async def reorder_workbench_interactions(
    room_id: uuid.UUID,
    payload: InteractionReorderRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> list[InteractionResponse]:
    """拖曳排序：重設房間內工作台互動項目的 order_no。"""
    return await interaction_service.reorder_workbench_interactions(
        db, room_id=room_id, host=host, payload=payload
    )


@router.delete("/interactions/{interaction_id}", status_code=204)
async def delete_interaction(
    interaction_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> None:
    """刪除互動項目（Poll／Quiz 等；須非 active）。"""
    await interaction_service.delete_interaction(
        db, interaction_id=interaction_id, host=host
    )
