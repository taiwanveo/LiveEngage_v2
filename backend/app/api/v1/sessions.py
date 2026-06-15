"""Session CRUD 與 Join API（FE-001/002、BE-001）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import get_client_ip
from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.room import RoomCreateRequest, RoomListResponse, RoomResponse
from app.schemas.session import (
    JoinRequest,
    JoinResponse,
    SessionCreateRequest,
    SessionHostListResponse,
    SessionHostResponse,
    SessionPublicResponse,
    SessionUpdateRequest,
)
from app.schemas.state import SessionStateResponse
from app.schemas.overview import ParticipantListResponse, SessionOverviewResponse
from app.services import overview_service, room_service, session_service, state_service

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=SessionHostListResponse)
async def list_sessions(
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SessionHostListResponse:
    """主持人活動列表。"""
    items = await session_service.list_host_sessions(db, host=host)
    return SessionHostListResponse(items=items)


@router.get("/by-code/{code}", response_model=SessionPublicResponse)
async def get_session_by_code(
    code: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SessionPublicResponse:
    """依活動代碼解析（FE-001-FR1）。"""
    return await session_service.resolve_session_by_code(
        db, code, client_ip=get_client_ip(request)
    )


@router.get("/{session_id}", response_model=SessionHostResponse)
async def read_session(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SessionHostResponse:
    """取得單一活動（含 default_room_id）。"""
    return await session_service.get_host_session(
        db, session_id=session_id, host=host
    )


@router.post("", response_model=SessionHostResponse, status_code=201)
async def create_session(
    payload: SessionCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SessionHostResponse:
    """建立活動（BE-001）。"""
    return await session_service.create_session(db, host=host, payload=payload)


@router.patch("/{session_id}", response_model=SessionHostResponse)
async def update_session(
    session_id: uuid.UUID,
    payload: SessionUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> SessionHostResponse:
    """更新活動設定或狀態。"""
    return await session_service.update_session(
        db, session_id=session_id, host=host, payload=payload
    )


@router.get("/{session_id}/state", response_model=SessionStateResponse)
async def get_session_state(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> SessionStateResponse:
    """活動快照（FE-003、RT-002 reconnect fallback）。"""
    return await state_service.get_session_state(db, session_id)


@router.post("/{session_id}/join", response_model=JoinResponse)
async def join_session(
    session_id: uuid.UUID,
    payload: JoinRequest,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> JoinResponse:
    """參與者加入活動（FE-001/002）。"""
    return await session_service.join_session(
        db,
        session_id=session_id,
        payload=payload,
        client_ip=get_client_ip(request),
    )


@router.get("/{session_id}/participants", response_model=ParticipantListResponse)
async def list_session_participants(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
    cursor: str | None = None,
    limit: int = Query(default=20, ge=1, le=100),
) -> ParticipantListResponse:
    """Host 參與者名單（分頁、mask_identity）。"""
    return await overview_service.list_session_participants(
        db,
        session_id=session_id,
        host=host,
        cursor=cursor,
        limit=limit,
    )


@router.get("/{session_id}/overview", response_model=SessionOverviewResponse)
async def get_session_overview(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
    room_id: uuid.UUID | None = None,
) -> SessionOverviewResponse:
    """Host 單一活動即時總覽（KPI + active poll + top Q&A + quiz/survey 摘要）。"""
    return await overview_service.get_session_overview(
        db,
        session_id=session_id,
        host=host,
        room_id=room_id,
    )


@router.get("/{session_id}/rooms", response_model=RoomListResponse)
async def list_session_rooms(
    session_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> RoomListResponse:
    """列出活動房間（多房間）。"""
    return await room_service.list_rooms(db, session_id=session_id, host=host)


@router.post("/{session_id}/rooms", response_model=RoomResponse, status_code=201)
async def create_session_room(
    session_id: uuid.UUID,
    payload: RoomCreateRequest,
    db: Annotated[AsyncSession, Depends(get_session)],
    host: Annotated[User, Depends(get_current_user)],
) -> RoomResponse:
    """新增活動房間。"""
    return await room_service.create_room(
        db, session_id=session_id, host=host, payload=payload
    )
