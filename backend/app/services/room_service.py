"""Room CRUD（多房間進階）。"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.schemas.room import RoomCreateRequest, RoomListResponse, RoomResponse


def _to_response(room: Room) -> RoomResponse:
    return RoomResponse(
        id=room.id,
        session_id=room.session_id,
        name=room.name,
        description=room.description,
        slug=room.slug,
        order_no=room.order_no,
        created_at=room.created_at,
        updated_at=room.updated_at,
    )


async def _get_session_for_host(
    db: AsyncSession, *, session_id: uuid.UUID, host: User
) -> Session:
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.org_id == host.org_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到活動")
    return session


async def list_rooms(
    db: AsyncSession, *, session_id: uuid.UUID, host: User
) -> RoomListResponse:
    await _get_session_for_host(db, session_id=session_id, host=host)
    result = await db.execute(
        select(Room).where(Room.session_id == session_id).order_by(Room.order_no.asc())
    )
    rooms = result.scalars().all()
    return RoomListResponse(items=[_to_response(r) for r in rooms])


async def create_room(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User,
    payload: RoomCreateRequest,
) -> RoomResponse:
    session = await _get_session_for_host(db, session_id=session_id, host=host)
    count_result = await db.execute(
        select(Room).where(Room.session_id == session.id)
    )
    order_no = len(count_result.scalars().all())
    room = Room(
        id=uuid7(),
        session_id=session.id,
        name=payload.name,
        description=payload.description,
        slug=payload.slug,
        order_no=order_no,
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return _to_response(room)
