"""互動項目業務邏輯（BE-002 子集；本 Sprint 供 Q&A 控場）。"""

from __future__ import annotations

import contextlib
import datetime as dt
import uuid
from typing import cast

from sqlalchemy import func, select, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.host_permissions import assert_can_access_host, assert_can_edit_content
from app.core.ids import uuid7
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.poll import PollOption, PollResponse
from app.models.room import Room
from app.models.sprint9 import QuizQuestion, SurveyQuestion
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.interaction import (
    InteractionCreateRequest,
    InteractionResponse,
    InteractionReorderRequest,
    InteractionUpdateRequest,
)
from app.schemas.poll import POLL_TYPES
from app.services.poll_redis import acquire_room_lock, release_room_lock, set_poll_agg_ttl


async def ensure_room_access(
    db: AsyncSession, room_id: uuid.UUID, host: User
) -> Room:
    """公開包裝：載入房間並驗證 host 權限（供其他 service 重用）。"""
    return await _load_room_for_host(db, room_id, host)


async def _load_room_for_host(db: AsyncSession, room_id: uuid.UUID, host: User) -> Room:
    """載入房間並驗證 host 有權操作（同 org 或活動 host）。"""
    assert_can_access_host(host)
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


def _is_workbench_interaction_type(interaction_type: InteractionType) -> bool:
    """工作台左欄顯示的互動類型（排除 Q&A）。"""
    return interaction_type != InteractionType.QA


async def reorder_workbench_interactions(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    payload: InteractionReorderRequest,
) -> list[InteractionResponse]:
    """依 ordered_ids 重設工作台互動的 order_no（0..n-1）。"""
    assert_can_edit_content(host)
    await _load_room_for_host(db, room_id, host)

    ordered_ids = payload.ordered_ids
    if len(ordered_ids) != len(set(ordered_ids)):
        raise AppError(ErrorCode.VALIDATION_ERROR, "ordered_ids 不可重複")

    result = await db.execute(
        select(Interaction).where(Interaction.room_id == room_id)
    )
    all_items = list(result.scalars().all())
    workbench = [i for i in all_items if _is_workbench_interaction_type(i.type)]
    expected_ids = {i.id for i in workbench}

    if set(ordered_ids) != expected_ids:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "ordered_ids 必須包含房間內所有工作台互動項目",
        )

    id_to_row = {i.id: i for i in workbench}
    for idx, interaction_id in enumerate(ordered_ids):
        id_to_row[interaction_id].order_no = idx

    await db.commit()

    for interaction in workbench:
        await db.refresh(interaction)

    workbench.sort(key=lambda i: (i.order_no, i.created_at))
    return [_to_response(i) for i in workbench]


async def create_interaction(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    payload: InteractionCreateRequest,
) -> InteractionResponse:
    """建立互動項目（BE-002）。"""
    assert_can_edit_content(host)
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
    room_id = interaction.room_id

    structural = (
        payload.title is not None
        or payload.description is not None
        or payload.settings is not None
        or payload.result_visible is not None
    )
    if structural:
        assert_can_edit_content(host)

    if payload.title is not None:
        interaction.title = payload.title
    if payload.description is not None:
        interaction.description = payload.description

    activating = (
        payload.status is not None
        and payload.status == InteractionStatus.ACTIVE
        and interaction.status != InteractionStatus.ACTIVE
    )

    lock_token: str | None = None
    if activating:
        lock_token = await acquire_room_lock(room_id)

    try:
        if payload.status is not None:
            if activating:
                if interaction.status not in (
                    InteractionStatus.IDLE,
                    InteractionStatus.STOPPED,
                ):
                    raise AppError(
                        ErrorCode.POLL_INVALID_STATE,
                        f"僅閒置或已結束的互動可開放（目前為「{interaction.status.value}」）",
                    )
                await _stop_other_active_in_room(db, room_id, interaction.id)
                await db.flush()
                _apply_status_transition(interaction, InteractionStatus.ACTIVE)
            elif payload.status != InteractionStatus.ACTIVE:
                if (
                    interaction.type == InteractionType.QUIZ
                    and payload.status == InteractionStatus.STOPPED
                ):
                    from app.services import quiz_service

                    await quiz_service.close_active_quiz_questions_for_parent(
                        db, interaction.id
                    )
                _apply_status_transition(interaction, payload.status)

        if payload.settings is not None:
            interaction.settings_jsonb = payload.settings
        if payload.result_visible is not None:
            interaction.result_visible = payload.result_visible

        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "同時僅能有一個進行中的互動，請先停止其他互動後再試",
        ) from exc
    finally:
        if lock_token is not None:
            with contextlib.suppress(Exception):
                await release_room_lock(room_id, lock_token)

    await db.refresh(interaction)

    if activating:
        await _broadcast_interaction_started(interaction, room_id)

    return _to_response(interaction)


async def _broadcast_interaction_started(
    interaction: Interaction,
    room_id: uuid.UUID,
) -> None:
    """互動開放時通知參與者（Quiz／Ideas／Survey／Q&A 等）。"""
    payload = {
        "interaction_id": str(interaction.id),
        "type": interaction.type.value,
        "title": interaction.title,
        "status": InteractionStatus.ACTIVE.value,
    }
    await events.publish(
        room_id,
        events.INTERACTION_STARTED,
        payload,
        target_modes=events.MODE_ALL,
    )


async def _stop_other_active_in_room(
    db: AsyncSession,
    room_id: uuid.UUID,
    except_id: uuid.UUID,
    *,
    also_except: uuid.UUID | None = None,
) -> None:
    """同一 room 僅允許一個 active（``uq_interactions_active_room``）；對齊 poll start。"""
    exclude = {except_id}
    if also_except is not None:
        exclude.add(also_except)
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.status == InteractionStatus.ACTIVE,
            Interaction.id.not_in(exclude),
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


async def _clear_poll_data(db: AsyncSession, interaction_id: uuid.UUID) -> None:
    await db.execute(
        delete(PollResponse).where(PollResponse.interaction_id == interaction_id)
    )
    await db.execute(
        delete(PollOption).where(PollOption.interaction_id == interaction_id)
    )


async def _delete_quiz_children(db: AsyncSession, quiz_interaction_id: uuid.UUID) -> None:
    result = await db.execute(
        select(QuizQuestion.child_interaction_id).where(
            QuizQuestion.quiz_interaction_id == quiz_interaction_id
        )
    )
    for (child_id,) in result.all():
        await _clear_poll_data(db, child_id)
        await db.execute(delete(Interaction).where(Interaction.id == child_id))
    await db.execute(
        delete(QuizQuestion).where(
            QuizQuestion.quiz_interaction_id == quiz_interaction_id
        )
    )


async def _delete_survey_children(db: AsyncSession, survey_interaction_id: uuid.UUID) -> None:
    result = await db.execute(
        select(SurveyQuestion.child_interaction_id).where(
            SurveyQuestion.survey_interaction_id == survey_interaction_id
        )
    )
    for (child_id,) in result.all():
        await _clear_poll_data(db, child_id)
        await db.execute(delete(Interaction).where(Interaction.id == child_id))
    await db.execute(
        delete(SurveyQuestion).where(
            SurveyQuestion.survey_interaction_id == survey_interaction_id
        )
    )


async def delete_interaction(
    db: AsyncSession,
    *,
    interaction_id: uuid.UUID,
    host: User,
) -> None:
    """刪除互動項目（須非 active；Quiz／Survey 一併清除子題）。"""
    assert_can_edit_content(host)
    interaction = await _load_interaction_for_host(db, interaction_id, host)
    if interaction.status == InteractionStatus.ACTIVE:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "進行中的互動須先停止後才能刪除",
        )

    if interaction.type == InteractionType.QUIZ:
        await _delete_quiz_children(db, interaction.id)
    elif interaction.type == InteractionType.SURVEY:
        await _delete_survey_children(db, interaction.id)
    elif interaction.type in POLL_TYPES:
        await _clear_poll_data(db, interaction.id)

    await db.delete(interaction)
    await db.commit()


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
