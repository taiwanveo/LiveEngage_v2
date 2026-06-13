"""Poll 控場業務邏輯（BE-005、PM-004；SDS §5.4）。

鐵律 5：同一 Room 同時僅一個 active Poll。
    保證層：Redis 房間鎖（5s TTL）+ DB partial UNIQUE (room_id) WHERE status='active'。

狀態機：idle → active → locked ↔ active → stopped → idle（reset）。
DB 轉移一律用樂觀鎖（UPDATE ... WHERE status=:expected）防並發競爭。
"""

from __future__ import annotations

import contextlib
import datetime as dt
import uuid
from typing import Any, cast

from sqlalchemy import delete, select
from sqlalchemy import update as sa_update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import InteractionStatus
from app.models.interaction import Interaction
from app.models.poll import PollOption, PollResponse
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.poll import (
    POLL_TYPES,
    PollAction,
    PollActionRequest,
    PollDetail,
    PollOptionPublic,
)
from app.services import audit_service
from app.services.poll_redis import (
    acquire_room_lock,
    clear_poll_agg,
    release_room_lock,
    set_poll_agg_ttl,
)

# ── 狀態機（BE-005-FR2；SDS §5.4）──────────────────────────────────
# action → (允許的來源 status 集合, 目標 status | None 表示不改 status)
_TRANSITIONS: dict[
    PollAction, tuple[frozenset[InteractionStatus], InteractionStatus | None]
] = {
    PollAction.START: (
        frozenset({InteractionStatus.IDLE, InteractionStatus.STOPPED}),
        InteractionStatus.ACTIVE,
    ),
    PollAction.LOCK: (
        frozenset({InteractionStatus.ACTIVE}),
        InteractionStatus.LOCKED,
    ),
    PollAction.UNLOCK: (
        frozenset({InteractionStatus.LOCKED}),
        InteractionStatus.ACTIVE,
    ),
    PollAction.STOP: (
        frozenset({InteractionStatus.ACTIVE, InteractionStatus.LOCKED}),
        InteractionStatus.STOPPED,
    ),
    PollAction.RESET: (
        frozenset(
            {
                InteractionStatus.ACTIVE,
                InteractionStatus.LOCKED,
                InteractionStatus.STOPPED,
            }
        ),
        InteractionStatus.IDLE,
    ),
    # reveal / hide 不改 status；允許 active / locked / stopped 時操作
    PollAction.REVEAL: (
        frozenset(
            {
                InteractionStatus.ACTIVE,
                InteractionStatus.LOCKED,
                InteractionStatus.STOPPED,
            }
        ),
        None,
    ),
    PollAction.HIDE: (
        frozenset(
            {
                InteractionStatus.ACTIVE,
                InteractionStatus.LOCKED,
                InteractionStatus.STOPPED,
            }
        ),
        None,
    ),
}

# start / stop / reset 會改變「room 內有無 active poll」，需搶房間鎖
_NEEDS_ROOM_LOCK: frozenset[PollAction] = frozenset(
    {PollAction.START, PollAction.STOP, PollAction.RESET}
)


# ── 載入輔助 ───────────────────────────────────────────────────────


async def _load_poll_for_host(
    db: AsyncSession, interaction_id: uuid.UUID, host: User
) -> tuple[Interaction, uuid.UUID]:
    """載入 Poll 並驗 host 權限；回 (interaction, room_id)。"""
    result = await db.execute(
        select(Interaction, Room, Session)
        .join(Room, Interaction.room_id == Room.id)
        .join(Session, Room.session_id == Session.id)
        .where(Interaction.id == interaction_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    interaction, room, session = row[0], row[1], row[2]
    if session.host_user_id != host.id and session.org_id != host.org_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權操作此互動項目")
    if interaction.type not in POLL_TYPES:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, f"此互動項目（{interaction.type}）不是 Poll 題型"
        )
    return interaction, room.id


async def load_poll_for_participant(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> Interaction:
    """載入 Poll 並驗 participant 與 interaction 同 room（鐵律 8）。"""
    from app.models.participant import Participant

    result = await db.execute(
        select(Interaction, Participant)
        .join(Room, Interaction.room_id == Room.id)
        .join(
            Participant,
            (Participant.room_id == Room.id) & (Participant.id == participant_id),
        )
        .where(Interaction.id == interaction_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此題目所在的房間")
    interaction = cast(Interaction, row[0])
    if interaction.type not in POLL_TYPES:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, f"此互動項目（{interaction.type}）不是 Poll 題型"
        )
    return interaction


# ── DB 樂觀鎖轉移 ──────────────────────────────────────────────────


async def _optimistic_status_update(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    from_status: InteractionStatus,
    to_status: InteractionStatus,
    extra: dict[str, Any] | None = None,
) -> None:
    """UPDATE WHERE status=from_status；rowcount=0 → 409 POLL_INVALID_STATE。"""
    now = dt.datetime.now(dt.UTC)
    fields: dict[str, Any] = {
        "status": to_status,
        "updated_at": now,
    }
    if to_status == InteractionStatus.ACTIVE:
        fields["started_at"] = now  # 重啟也更新 started_at
    if to_status == InteractionStatus.STOPPED:
        fields["stopped_at"] = now
    if to_status == InteractionStatus.IDLE:
        fields["started_at"] = None
        fields["stopped_at"] = None
    if extra:
        fields.update(extra)

    cursor = cast(
        CursorResult[Any],
        await db.execute(
            sa_update(Interaction)
            .where(Interaction.id == interaction_id, Interaction.status == from_status)
            .values(**fields)
        ),
    )
    if cursor.rowcount == 0:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "Poll 狀態已被其他操作更改，請重新整理後再試",
        )


# ── 各動作副作用 ────────────────────────────────────────────────────


async def _action_start(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    host: User,
) -> None:
    """start：idle/stopped → active；在房間鎖內執行。"""
    # 先查同 room 是否有另一個 active poll → 自動 stop 它
    existing_result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.status == InteractionStatus.ACTIVE,
            Interaction.id != interaction.id,
        )
    )
    existing_active = existing_result.scalars().first()
    if existing_active is not None:
        await _optimistic_status_update(
            db, existing_active.id, InteractionStatus.ACTIVE, InteractionStatus.STOPPED,
            extra={"stopped_at": dt.datetime.now(dt.UTC)},
        )
        # 固化舊 poll 的 Redis agg TTL，廣播停止
        await set_poll_agg_ttl(existing_active.id)
        await events.publish(
            room_id, events.POLL_STOPPED,
            {"poll_id": str(existing_active.id), "status": "stopped"},
        )

    await _optimistic_status_update(
        db, interaction.id, interaction.status, InteractionStatus.ACTIVE,
    )
    await db.commit()

    options = await _get_options(db, interaction.id, hide_correct=True)
    await events.publish(
        room_id,
        events.POLL_STARTED,
        {
            "poll_id": str(interaction.id),
            "type": interaction.type,
            "title": interaction.title,
            "options": [o.model_dump() for o in options],
            "settings_public": _public_settings(interaction),
            "result_visible": interaction.result_visible,
        },
    )


async def _action_stop(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
) -> None:
    """stop：active/locked → stopped；固化 Redis agg TTL；廣播。"""
    await _optimistic_status_update(
        db, interaction.id, interaction.status, InteractionStatus.STOPPED,
    )
    await db.commit()
    await set_poll_agg_ttl(interaction.id)
    await events.publish(
        room_id, events.POLL_STOPPED,
        {"poll_id": str(interaction.id), "status": "stopped"},
    )


async def _action_reset(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    confirm: bool,
) -> None:
    """reset：清 poll_responses + 清 Redis agg + idle；需 confirm=true。"""
    if not confirm:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "reset 動作需要帶 confirm=true 確認",
        )
    # 刪全部作答
    await db.execute(
        delete(PollResponse).where(PollResponse.interaction_id == interaction.id)
    )
    await _optimistic_status_update(
        db, interaction.id, interaction.status, InteractionStatus.IDLE,
    )
    await db.commit()
    await clear_poll_agg(interaction.id)
    await events.publish(
        room_id, events.POLL_STOPPED,
        {"poll_id": str(interaction.id), "status": "idle"},
    )


async def _action_lock_unlock(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    to_status: InteractionStatus,
) -> None:
    """lock / unlock：僅 DB 樂觀鎖，不需房間鎖。"""
    await _optimistic_status_update(
        db, interaction.id, interaction.status, to_status,
    )
    await db.commit()
    event_type = (
        events.POLL_LOCKED if to_status == InteractionStatus.LOCKED else events.POLL_UNLOCKED
    )
    await events.publish(
        room_id, event_type,
        {"poll_id": str(interaction.id), "status": to_status},
    )


async def _action_reveal_hide(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    reveal: bool,
) -> None:
    """reveal / hide：只改 result_visible；DB 直接 UPDATE（不須 status 配對）。"""
    cursor = cast(
        CursorResult[Any],
        await db.execute(
            sa_update(Interaction)
            .where(Interaction.id == interaction.id)
            .values(result_visible=reveal, updated_at=dt.datetime.now(dt.UTC))
        ),
    )
    if cursor.rowcount == 0:
        raise AppError(ErrorCode.NOT_FOUND, "互動項目不存在")
    await db.commit()

    event_type = events.POLL_RESULT_REVEALED if reveal else events.POLL_RESULT_HIDDEN
    payload: dict[str, Any] = {"poll_id": str(interaction.id)}
    if reveal:
        # 揭示時一併送正解 option_ids（PM-003-FR5）
        correct_ids = await _get_correct_option_ids(db, interaction.id)
        if correct_ids:
            payload["correct_option_ids"] = [str(oid) for oid in correct_ids]
    await events.publish(room_id, event_type, payload)


# ── 公開進入點 ──────────────────────────────────────────────────────


async def execute_poll_action(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    host: User,
    request: PollActionRequest,
) -> None:
    """控場入口（BE-005-FR1）：驗狀態機、取鎖、執行、寫 audit、釋鎖。"""
    action = request.action

    if action in (PollAction.NEXT, PollAction.PREV):
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "next/prev 由 Quiz/排序控制台層處理，尚未實作",
        )

    transition = _TRANSITIONS.get(action)
    if transition is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"不支援的動作：{action}")

    allowed_sources, target_status = transition
    interaction, room_id = await _load_poll_for_host(db, interaction_id, host)

    if interaction.status not in allowed_sources:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            f"動作 {action} 不允許在 {interaction.status} 狀態執行"
            f"（允許來源：{', '.join(s.value for s in allowed_sources)}）",
        )

    lock_token: str | None = None
    if action in _NEEDS_ROOM_LOCK:
        lock_token = await acquire_room_lock(room_id)

    try:
        if action == PollAction.START:
            await _action_start(db, interaction, room_id, host)
        elif action == PollAction.STOP:
            await _action_stop(db, interaction, room_id)
        elif action == PollAction.RESET:
            await _action_reset(db, interaction, room_id, request.confirm)
        elif action in (PollAction.LOCK, PollAction.UNLOCK):
            assert target_status is not None
            await _action_lock_unlock(db, interaction, room_id, target_status)
        elif action == PollAction.REVEAL:
            await _action_reveal_hide(db, interaction, room_id, reveal=True)
        elif action == PollAction.HIDE:
            await _action_reveal_hide(db, interaction, room_id, reveal=False)
    finally:
        if lock_token is not None:
            with contextlib.suppress(Exception):
                await release_room_lock(room_id, lock_token)

    # audit（鐵律 10）—— 已在各 action 的 commit 之後，開新 tx 寫
    async with db.begin():
        await audit_service.log(
            db,
            actor=host,
            action=f"poll.{action}",
            target_type="interaction",
            target_id=interaction_id,
            room_id=room_id,
            details={"confirm": request.confirm} if action == PollAction.RESET else {},
        )


# ── Poll 詳情（GET /polls/{id}）──────────────────────────────────────


async def get_poll_detail(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    viewer_id: uuid.UUID,
    is_host: bool,
) -> PollDetail:
    """組裝 PollDetail；揭示前不含 is_correct（PM-003-FR5）。"""
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    interaction = result.scalars().first()
    if interaction is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")

    hide_correct = not (is_host or interaction.result_visible)
    options = await _get_options(db, interaction_id, hide_correct=hide_correct)

    my_submitted = False
    if not is_host:
        resp = await db.execute(
            select(PollResponse.id).where(
                PollResponse.interaction_id == interaction_id,
                PollResponse.participant_id == viewer_id,
            ).limit(1)
        )
        my_submitted = resp.first() is not None

    return PollDetail(
        id=interaction.id,
        room_id=interaction.room_id,
        type=interaction.type,
        title=interaction.title,
        description=interaction.description,
        status=interaction.status,
        result_visible=interaction.result_visible,
        settings_public=_public_settings(interaction),
        options=options,
        my_submitted=my_submitted,
    )


# ── 內部輔助 ───────────────────────────────────────────────────────


def _public_settings(interaction: Interaction) -> dict[str, Any]:
    """settings_jsonb，但移除 host-only 欄位（如 has_correct）。"""
    settings = dict(interaction.settings_jsonb or {})
    settings.pop("has_correct", None)
    return settings


async def _get_options(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    *,
    hide_correct: bool,
) -> list[PollOptionPublic]:
    result = await db.execute(
        select(PollOption)
        .where(PollOption.interaction_id == interaction_id)
        .order_by(PollOption.order_no)
    )
    options = result.scalars().all()
    return [
        PollOptionPublic(
            id=opt.id,
            text=opt.text,
            order_no=opt.order_no,
            is_correct=None if hide_correct else opt.is_correct,
        )
        for opt in options
    ]


async def _get_correct_option_ids(
    db: AsyncSession, interaction_id: uuid.UUID
) -> list[uuid.UUID]:
    result = await db.execute(
        select(PollOption.id).where(
            PollOption.interaction_id == interaction_id,
            PollOption.is_correct.is_(True),
        )
    )
    return list(result.scalars().all())


# ── Options Builder（BE-003）────────────────────────────────────────


async def upsert_poll_options(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    host: User,
    option_payloads: list[dict[str, Any]],
) -> list[PollOptionPublic]:
    """取代當前 poll 所有選項（Builder UI 儲存）；Host-only。"""
    _, _ = await _load_poll_for_host(db, interaction_id, host)

    # 刪舊選項
    await db.execute(
        delete(PollOption).where(PollOption.interaction_id == interaction_id)
    )
    now = dt.datetime.now(dt.UTC)
    new_opts: list[PollOption] = []
    for i, p in enumerate(option_payloads):
        opt = PollOption(
            id=uuid7(),
            interaction_id=interaction_id,
            text=str(p.get("text", "")),
            is_correct=bool(p.get("is_correct", False)),
            order_no=int(p.get("order_no", i)),
            created_at=now,
        )
        db.add(opt)
        new_opts.append(opt)
    await db.commit()

    return [
        PollOptionPublic(id=o.id, text=o.text, order_no=o.order_no)
        for o in new_opts
    ]
