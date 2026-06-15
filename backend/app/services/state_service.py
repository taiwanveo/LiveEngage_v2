"""Session 快照服務（GET /sessions/{id}/state）。"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.room import Room
from app.models.session import Session
from app.models.sprint9 import QuizQuestion
from app.schemas.state import (
    ActiveInteractionSnapshot,
    RoomSnapshot,
    SessionStateResponse,
)


async def get_session_state(
    db: AsyncSession, session_id: uuid.UUID
) -> SessionStateResponse:
    """組裝活動快照供初載 / reconnect（RT-002-FR5 fallback）。"""
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.SESSION_NOT_FOUND, "找不到活動")

    rooms_result = await db.execute(
        select(Room).where(Room.session_id == session_id).order_by(Room.order_no)
    )
    rooms = [
        RoomSnapshot(id=r.id, name=r.name, order_no=r.order_no)
        for r in rooms_result.scalars().all()
    ]

    active: list[ActiveInteractionSnapshot] = []
    if rooms:
        room_ids = [r.id for r in rooms]
        quiz_child_ids = select(QuizQuestion.child_interaction_id)
        active_result = await db.execute(
            select(Interaction).where(
                Interaction.room_id.in_(room_ids),
                Interaction.id.not_in(quiz_child_ids),
                or_(
                    Interaction.status == InteractionStatus.ACTIVE,
                    and_(
                        Interaction.type == InteractionType.QUIZ,
                        Interaction.status == InteractionStatus.LOCKED,
                    ),
                ),
            )
        )
        active = [
            ActiveInteractionSnapshot(
                id=i.id,
                room_id=i.room_id,
                type=i.type.value,
                title=i.title,
                status=i.status.value,
            )
            for i in active_result.scalars().all()
        ]

    count_result = await db.execute(
        select(func.count())
        .select_from(Participant)
        .where(
            Participant.session_id == session_id,
            Participant.is_preview.is_(False),
        )
    )
    participant_count = int(count_result.scalar_one())

    return SessionStateResponse(
        session_id=session.id,
        title=session.title,
        code=session.code,
        status=session.status,
        language=session.language,
        rooms=rooms,
        active_interactions=active,
        participant_count=participant_count,
        server_time=dt.datetime.now(dt.UTC),
    )
