"""互動項目業務邏輯（BE-002 子集；本 Sprint 供 Q&A 控場）。"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.interaction import (
    InteractionCreateRequest,
    InteractionResponse,
    InteractionUpdateRequest,
)
from app.schemas.poll import POLL_TYPES
from app.services.poll_redis import set_poll_agg_ttl


async def ensure_room_access(
    db: AsyncSession, room_id: uuid.UUID, host: User
) -> Room:
    """公開包裝：載入房間並驗證 host 權限（供其他 service 重用）。"""
    return await _load_room_for_host(db, room_id, host)


async def _load_room_for_host(db: AsyncSession, room_id: uuid.UUID, host: User) -> Room:
    """載入房間並驗證 host 有權操作（同 org 或活動 host）。"""
    result = await db.execute(
        select(Room, Session)
        .join(Session, Room.session_id == Session.id)
        .where(Room.id == room_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到房間")
    room = cast(Room, row[0])
    session = cast(Session, row[1])
    if session.host_user_id != host.id and session.org_id != host.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權操作此房間")
    return room


async def _load_interaction_for_host(
    db: AsyncSession, interaction_id: uuid.UUID, host: User
) -> Interaction:
    result = await db.execute(
        select(Interaction, Session)
        .join(Room, Interaction.room_id == Room.id)
        .join(Session, Room.session_id == Session.id)
        .where(Interaction.id == interaction_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    interaction = cast(Interaction, row[0])
    session = cast(Session, row[1])
    if session.host_user_id != host.id and session.org_id != host.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權操作此互動項目")
    return interaction


async def list_room_interactions(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
) -> list[InteractionResponse]:
    """列出房間內所有互動項目（Host Builder / 控制台）。"""
    await _load_room_for_host(db, room_id, host)
    result = await db.execute(
        select(Interaction)
        .where(Interaction.room_id == room_id)
        .order_by(Interaction.order_no, Interaction.created_at)
    )
    return [_to_response(i) for i in result.scalars().all()]


async def create_interaction(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    payload: InteractionCreateRequest,
) -> InteractionResponse:
    """建立互動項目（BE-002）。"""
    await _load_room_for_host(db, room_id, host)

    max_order = await db.execute(
        select(func.coalesce(func.max(Interaction.order_no), -1)).where(
            Interaction.room_id == room_id
        )
    )
    next_order = int(max_order.scalar_one()) + 1

    interaction = Interaction(
        id=uuid7(),
        room_id=room_id,
        type=payload.type,
        title=payload.title,
        description=payload.description,
        status=InteractionStatus.IDLE,
        order_no=next_order,
        settings_jsonb=payload.settings,
        created_by=host.id,
    )
    db.add(interaction)
    await db.commit()
    await db.refresh(interaction)
    return _to_response(interaction)


async def update_interaction(
    db: AsyncSession,
    *,
    interaction_id: uuid.UUID,
    host: User,
    payload: InteractionUpdateRequest,
) -> InteractionResponse:
    """更新互動項目（標題／狀態／設定）。"""
    interaction = await _load_interaction_for_host(db, interaction_id, host)

    if payload.title is not None:
        interaction.title = payload.title
    if payload.description is not None:
        interaction.description = payload.description
    if payload.status is not None:
        if payload.status == InteractionStatus.ACTIVE:
            await _stop_other_active_in_room(
                db, interaction.room_id, interaction.id
            )
        _apply_status_transition(interaction, payload.status)
    if payload.settings is not None:
        interaction.settings_jsonb = payload.settings
    if payload.result_visible is not None:
        interaction.result_visible = payload.result_visible

    await db.commit()
    await db.refresh(interaction)
    return _to_response(interaction)


async def _stop_other_active_in_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    except_id: uuid.UUID,
) -> None:
    """同一 room 僅允許一個 active（``uq_interactions_active_room``）；對齊 poll start。"""
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.status == InteractionStatus.ACTIVE,
            Interaction.id != except_id,
        )
    )
    now = dt.datetime.now(dt.UTC)
    for other in result.scalars().all():
        other.status = InteractionStatus.STOPPED
        other.stopped_at = now
        if other.type in POLL_TYPES:
            await set_poll_agg_ttl(other.id)
            await events.publish(
                room_id,
                events.POLL_STOPPED,
                {"poll_id": str(other.id), "status": "stopped"},
            )


def _apply_status_transition(
    interaction: Interaction, new_status: InteractionStatus
) -> None:
    """套用狀態並維護 started_at / stopped_at。"""
    now = dt.datetime.now(dt.UTC)
    if new_status == InteractionStatus.ACTIVE and interaction.started_at is None:
        interaction.started_at = now
    if new_status == InteractionStatus.STOPPED:
        interaction.stopped_at = now
    interaction.status = new_status


async def get_active_qa(db: AsyncSession, room_id: uuid.UUID) -> Interaction | None:
    """取得房間目前開放（active）的 Q&A 互動。"""
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.type == InteractionType.QA,
            Interaction.status == InteractionStatus.ACTIVE,
        )
    )
    return result.scalars().first()


async def get_qa_interaction(db: AsyncSession, room_id: uuid.UUID) -> Interaction | None:
    """取得房間最新的 Q&A 互動（不限狀態，供讀取設定）。"""
    result = await db.execute(
        select(Interaction)
        .where(
            Interaction.room_id == room_id,
            Interaction.type == InteractionType.QA,
        )
        .order_by(Interaction.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


def _to_response(interaction: Interaction) -> InteractionResponse:
    return InteractionResponse(
        id=interaction.id,
        room_id=interaction.room_id,
        type=interaction.type,
        title=interaction.title,
        description=interaction.description,
        status=interaction.status,
        order_no=interaction.order_no,
        settings=interaction.settings_jsonb,
        result_visible=interaction.result_visible,
        created_at=interaction.created_at,
        updated_at=interaction.updated_at,
    )
