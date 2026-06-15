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
from collections.abc import Awaitable, Callable
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy import update as sa_update
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.host_permissions import assert_can_edit_content
from app.core.ids import uuid7
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollOption, PollResponse
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.realtime import events
from app.schemas.poll import (
    POLL_TYPES,
    MultipleChoiceAnswer,
    MultipleChoiceSettings,
    OpenTextAnswer,
    OpenTextSettings,
    OptionCount,
    PollAction,
    PollActionRequest,
    PollActionResponse,
    PollDetail,
    PollOptionPublic,
    PollResults,
    PollSubmitRequest,
    PollSubmitResult,
    RankingAnswer,
    RankingOrderCount,
    RankingSettings,
    RatingAnswer,
    RatingSettings,
    TextEntry,
    WordCloudAnswer,
    WordCloudSettings,
    WordCount,
    parse_answer,
    parse_settings,
)
from app.serializers.mask_identity import mask_identity
from app.services import audit_service, rate_limit_service
from app.services.poll_redis import (
    acquire_room_lock,
    check_poll_submit_rate_limit,
    clear_poll_agg,
    get_poll_agg,
    increment_option_count,
    increment_rating_agg,
    release_room_lock,
    set_poll_agg_ttl,
    throttled_broadcast_result,
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

PostCommitHook = Callable[[], Awaitable[None]]


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
) -> list[PostCommitHook]:
    """start：idle/stopped → active；在房間鎖內執行（不 commit，由入口統一提交）。"""
    existing_result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.status == InteractionStatus.ACTIVE,
            Interaction.id != interaction.id,
        )
    )
    existing_active = existing_result.scalars().first()
    stopped_poll_id: uuid.UUID | None = None
    if existing_active is not None:
        await _optimistic_status_update(
            db,
            existing_active.id,
            InteractionStatus.ACTIVE,
            InteractionStatus.STOPPED,
            extra={"stopped_at": dt.datetime.now(dt.UTC)},
        )
        stopped_poll_id = existing_active.id

    await _optimistic_status_update(
        db,
        interaction.id,
        interaction.status,
        InteractionStatus.ACTIVE,
        extra={"result_visible": False},
    )
    interaction.status = InteractionStatus.ACTIVE
    interaction.result_visible = False
    await db.flush()

    options = await _get_options(db, interaction.id, hide_correct=True)
    start_payload = {
        "poll_id": str(interaction.id),
        "type": interaction.type,
        "title": interaction.title,
        "options": [o.model_dump() for o in options],
        "settings_public": _public_settings(interaction),
        "result_visible": False,
    }

    async def _after_commit() -> None:
        if stopped_poll_id is not None:
            await set_poll_agg_ttl(stopped_poll_id)
            await events.publish(
                room_id,
                events.POLL_STOPPED,
                {"poll_id": str(stopped_poll_id), "status": "stopped"},
            )
        await events.publish(room_id, events.POLL_STARTED, start_payload)

    return [_after_commit]


async def _action_stop(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
) -> list[PostCommitHook]:
    """stop：active/locked → stopped；固化 Redis agg TTL；廣播。"""
    await _optimistic_status_update(
        db, interaction.id, interaction.status, InteractionStatus.STOPPED,
    )
    interaction.status = InteractionStatus.STOPPED
    await db.flush()
    poll_id = interaction.id

    async def _after_commit() -> None:
        await set_poll_agg_ttl(poll_id)
        await events.publish(
            room_id,
            events.POLL_STOPPED,
            {"poll_id": str(poll_id), "status": "stopped"},
        )

    return [_after_commit]


async def _action_reset(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    confirm: bool,
) -> list[PostCommitHook]:
    """reset：清 poll_responses + 清 Redis agg + idle；需 confirm=true。"""
    if not confirm:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            "reset 動作需要帶 confirm=true 確認",
        )
    await db.execute(
        delete(PollResponse).where(PollResponse.interaction_id == interaction.id)
    )
    await _optimistic_status_update(
        db, interaction.id, interaction.status, InteractionStatus.IDLE,
    )
    interaction.status = InteractionStatus.IDLE
    interaction.result_visible = False
    await db.flush()
    poll_id = interaction.id

    async def _after_commit() -> None:
        await clear_poll_agg(poll_id)
        await events.publish(
            room_id,
            events.POLL_STOPPED,
            {"poll_id": str(poll_id), "status": "idle"},
        )

    return [_after_commit]


async def _action_lock_unlock(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    to_status: InteractionStatus,
) -> list[PostCommitHook]:
    """lock / unlock：僅 DB 樂觀鎖，不需房間鎖。"""
    await _optimistic_status_update(
        db, interaction.id, interaction.status, to_status,
    )
    interaction.status = to_status
    await db.flush()
    poll_id = interaction.id
    event_type = (
        events.POLL_LOCKED if to_status == InteractionStatus.LOCKED else events.POLL_UNLOCKED
    )

    async def _after_commit() -> None:
        await events.publish(
            room_id,
            event_type,
            {"poll_id": str(poll_id), "status": to_status.value},
        )

    return [_after_commit]


async def _action_reveal_hide(
    db: AsyncSession,
    interaction: Interaction,
    room_id: uuid.UUID,
    reveal: bool,
) -> list[PostCommitHook]:
    """reveal / hide：只改 result_visible。"""
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
    interaction.result_visible = reveal
    await db.flush()

    poll_id = interaction.id
    event_type = events.POLL_RESULT_REVEALED if reveal else events.POLL_RESULT_HIDDEN
    payload: dict[str, Any] = {"poll_id": str(poll_id)}
    correct_id_strs: list[str] = []
    if reveal:
        correct_ids = await _get_correct_option_ids(db, interaction.id)
        if correct_ids:
            correct_id_strs = [str(oid) for oid in correct_ids]
            payload["correct_option_ids"] = correct_id_strs

    async def _after_commit() -> None:
        await events.publish(room_id, event_type, payload)

    return [_after_commit]


# ── 公開進入點 ──────────────────────────────────────────────────────


async def execute_poll_action(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    host: User,
    request: PollActionRequest,
) -> PollActionResponse:
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

    post_commit_hooks: list[PostCommitHook] = []
    try:
        if action == PollAction.START:
            post_commit_hooks.extend(
                await _action_start(db, interaction, room_id, host)
            )
        elif action == PollAction.STOP:
            post_commit_hooks.extend(await _action_stop(db, interaction, room_id))
        elif action == PollAction.RESET:
            post_commit_hooks.extend(
                await _action_reset(db, interaction, room_id, request.confirm)
            )
        elif action in (PollAction.LOCK, PollAction.UNLOCK):
            assert target_status is not None
            post_commit_hooks.extend(
                await _action_lock_unlock(db, interaction, room_id, target_status)
            )
        elif action == PollAction.REVEAL:
            post_commit_hooks.extend(
                await _action_reveal_hide(db, interaction, room_id, reveal=True)
            )
        elif action == PollAction.HIDE:
            post_commit_hooks.extend(
                await _action_reveal_hide(db, interaction, room_id, reveal=False)
            )
    finally:
        if lock_token is not None:
            with contextlib.suppress(Exception):
                await release_room_lock(room_id, lock_token)

    await audit_service.log(
        db,
        actor=host,
        action=f"poll.{action}",
        target_type="interaction",
        target_id=interaction_id,
        room_id=room_id,
        details={"confirm": request.confirm} if action == PollAction.RESET else {},
    )
    await db.commit()

    for hook in post_commit_hooks:
        await hook()

    refreshed = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    current = refreshed.scalars().first()
    if current is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")

    results_snapshot: PollResults | None = None
    if action in (PollAction.REVEAL, PollAction.RESET):
        results_snapshot = await get_poll_results(
            db, interaction_id, is_host=True
        )

    return PollActionResponse(
        poll_id=current.id,
        status=current.status,
        result_visible=current.result_visible,
        results=results_snapshot,
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
    assert_can_edit_content(host)
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


# ── 作答（FE-006~010；S5-3 multiple_choice 先）──────────────────────


async def submit_poll_response(
    db: AsyncSession,
    *,
    interaction_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None = None,
) -> PollSubmitResult:
    """提交作答；僅 ``status=active`` 接受（FE-006-AC2/AC4）。"""
    interaction = await load_poll_for_participant(db, interaction_id, participant_id)

    if interaction.status != InteractionStatus.ACTIVE:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            f"Poll 目前為 {interaction.status}，僅 active 狀態可作答",
        )

    limits = await rate_limit_service.limits_for_room(db, interaction.room_id)
    await check_poll_submit_rate_limit(
        participant_id, limit=limits.poll_submit_per_min
    )

    if interaction.type == InteractionType.MULTIPLE_CHOICE:
        return await _submit_multiple_choice(
            db,
            interaction=interaction,
            participant_id=participant_id,
            payload=payload,
            idempotency_key=idempotency_key,
        )
    if interaction.type == InteractionType.WORD_CLOUD:
        return await _submit_word_cloud(
            db,
            interaction=interaction,
            participant_id=participant_id,
            payload=payload,
            idempotency_key=idempotency_key,
        )
    if interaction.type == InteractionType.OPEN_TEXT:
        return await _submit_open_text(
            db,
            interaction=interaction,
            participant_id=participant_id,
            payload=payload,
            idempotency_key=idempotency_key,
        )
    if interaction.type == InteractionType.RATING:
        return await _submit_rating(
            db,
            interaction=interaction,
            participant_id=participant_id,
            payload=payload,
            idempotency_key=idempotency_key,
        )
    if interaction.type == InteractionType.RANKING:
        return await _submit_ranking(
            db,
            interaction=interaction,
            participant_id=participant_id,
            payload=payload,
            idempotency_key=idempotency_key,
        )

    raise AppError(
        ErrorCode.VALIDATION_ERROR,
        f"題型 {interaction.type} 不支援作答",
    )


async def _submit_multiple_choice(
    db: AsyncSession,
    *,
    interaction: Interaction,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None,
) -> PollSubmitResult:
    """multiple_choice 作答：驗證、寫 DB、更新 Redis agg（絕對值廣播）。"""
    settings = cast(
        MultipleChoiceSettings,
        parse_settings(InteractionType.MULTIPLE_CHOICE, interaction.settings_jsonb),
    )
    try:
        parsed = parse_answer(InteractionType.MULTIPLE_CHOICE, payload.answer)
    except ValueError as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, str(exc)) from exc
    if not isinstance(parsed, MultipleChoiceAnswer):
        raise AppError(ErrorCode.VALIDATION_ERROR, "答案格式錯誤")

    answer = parsed
    option_ids = answer.option_ids

    valid_ids = await _get_valid_option_ids(db, interaction.id)
    if not valid_ids:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此 Poll 尚無選項")
    invalid = [oid for oid in option_ids if oid not in valid_ids]
    if invalid:
        raise AppError(ErrorCode.VALIDATION_ERROR, "含有無效的選項")

    count = len(option_ids)
    if not settings.multi_select and count != 1:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此題為單選，只能選一個選項")
    if count < settings.min_select or count > settings.max_select:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"選項數量須介於 {settings.min_select} 與 {settings.max_select}",
        )

    existing_result = await db.execute(
        select(PollResponse).where(
            PollResponse.interaction_id == interaction.id,
            PollResponse.participant_id == participant_id,
            PollResponse.submission_no == 0,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None and not settings.allow_change:
        raise AppError(ErrorCode.ALREADY_RESPONDED, "您已提交過答案，且不允許更改")

    now = dt.datetime.now(dt.UTC)
    answer_data = {"option_ids": [str(oid) for oid in option_ids]}

    old_option_ids: list[str] = []
    if existing is not None:
        old_raw = existing.answer_jsonb.get("option_ids", [])
        old_option_ids = [str(x) for x in old_raw]
        existing.answer_jsonb = answer_data
        existing.submitted_at = now
        if idempotency_key is not None:
            existing.idempotency_key = idempotency_key
    else:
        db.add(
            PollResponse(
                id=uuid7(),
                interaction_id=interaction.id,
                participant_id=participant_id,
                answer_jsonb=answer_data,
                submission_no=0,
                idempotency_key=idempotency_key,
                submitted_at=now,
            )
        )

    await db.commit()

    for old_oid in old_option_ids:
        await increment_option_count(interaction.id, old_oid, delta=-1)
    for new_oid in option_ids:
        await increment_option_count(interaction.id, str(new_oid), delta=1)

    return await _finish_submit_broadcast(db, interaction)


async def _submit_word_cloud(
    db: AsyncSession,
    *,
    interaction: Interaction,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None,
) -> PollSubmitResult:
    """word_cloud 作答：多次提交、詞長驗證、Redis 詞頻（FE-007）。"""
    settings = cast(
        WordCloudSettings,
        parse_settings(InteractionType.WORD_CLOUD, interaction.settings_jsonb),
    )
    answer = cast(WordCloudAnswer, _parse_answer_typed(InteractionType.WORD_CLOUD, payload))

    submitted = await _count_participant_submissions(
        db, interaction.id, participant_id
    )
    if submitted >= settings.max_submissions:
        raise AppError(
            ErrorCode.ALREADY_RESPONDED,
            f"已達提交上限（{settings.max_submissions} 次）",
        )

    normalized_words: list[str] = []
    for word in answer.words:
        stripped = word.strip()
        if not stripped:
            raise AppError(ErrorCode.VALIDATION_ERROR, "詞彙不可為空白")
        if len(stripped) > settings.max_word_length:
            raise AppError(
                ErrorCode.VALIDATION_ERROR,
                f"詞彙長度不可超過 {settings.max_word_length} 字",
            )
        normalized_words.append(stripped)

    submission_no = await _next_submission_no(db, interaction.id, participant_id)
    now = dt.datetime.now(dt.UTC)
    answer_data = {"words": normalized_words}

    db.add(
        PollResponse(
            id=uuid7(),
            interaction_id=interaction.id,
            participant_id=participant_id,
            answer_jsonb=answer_data,
            submission_no=submission_no,
            idempotency_key=idempotency_key,
            submitted_at=now,
        )
    )
    await db.commit()

    for word in normalized_words:
        key = word.casefold()
        await increment_option_count(interaction.id, key, delta=1)

    return await _finish_submit_broadcast(db, interaction)


async def _submit_open_text(
    db: AsyncSession,
    *,
    interaction: Interaction,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None,
) -> PollSubmitResult:
    """open_text 作答：字數驗證、單次/多次提交（FE-008）。"""
    settings = cast(
        OpenTextSettings,
        parse_settings(InteractionType.OPEN_TEXT, interaction.settings_jsonb),
    )
    answer = cast(OpenTextAnswer, _parse_answer_typed(InteractionType.OPEN_TEXT, payload))
    text = answer.text.strip()
    if not text:
        raise AppError(ErrorCode.VALIDATION_ERROR, "回答不可為空白")
    if len(text) > settings.max_length:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"回答長度不可超過 {settings.max_length} 字",
        )

    submission_no: int
    if settings.allow_multiple:
        submission_no = await _next_submission_no(db, interaction.id, participant_id)
    else:
        existing = await _get_single_submission(
            db, interaction.id, participant_id
        )
        if existing is not None:
            raise AppError(ErrorCode.ALREADY_RESPONDED, "您已提交過答案")
        submission_no = 0

    now = dt.datetime.now(dt.UTC)
    db.add(
        PollResponse(
            id=uuid7(),
            interaction_id=interaction.id,
            participant_id=participant_id,
            answer_jsonb={"text": text},
            submission_no=submission_no,
            idempotency_key=idempotency_key,
            submitted_at=now,
        )
    )
    await db.commit()
    return await _finish_submit_broadcast(db, interaction, submission_no=submission_no)


async def _submit_rating(
    db: AsyncSession,
    *,
    interaction: Interaction,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None,
) -> PollSubmitResult:
    """rating 作答：區間驗證、單次提交、Redis sum/count（FE-009）。"""
    settings = cast(
        RatingSettings,
        parse_settings(InteractionType.RATING, interaction.settings_jsonb),
    )
    answer = cast(RatingAnswer, _parse_answer_typed(InteractionType.RATING, payload))
    value = answer.value
    if value < settings.min_value or value > settings.max_value:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"評分須介於 {settings.min_value} 與 {settings.max_value}",
        )

    existing = await _get_single_submission(db, interaction.id, participant_id)
    if existing is not None:
        raise AppError(ErrorCode.ALREADY_RESPONDED, "您已提交過評分")

    now = dt.datetime.now(dt.UTC)
    db.add(
        PollResponse(
            id=uuid7(),
            interaction_id=interaction.id,
            participant_id=participant_id,
            answer_jsonb={"value": value},
            submission_no=0,
            idempotency_key=idempotency_key,
            submitted_at=now,
        )
    )
    await db.commit()

    await increment_rating_agg(interaction.id, value)
    await increment_option_count(interaction.id, f"r:{value}", delta=1)

    return await _finish_submit_broadcast(db, interaction)


async def _submit_ranking(
    db: AsyncSession,
    *,
    interaction: Interaction,
    participant_id: uuid.UUID,
    payload: PollSubmitRequest,
    idempotency_key: uuid.UUID | None,
) -> PollSubmitResult:
    """ranking 作答：無重複、Borda 計分（FE-010）。"""
    settings = cast(
        RankingSettings,
        parse_settings(InteractionType.RANKING, interaction.settings_jsonb),
    )
    answer = cast(RankingAnswer, _parse_answer_typed(InteractionType.RANKING, payload))
    ranked = answer.ranked_option_ids

    if len(ranked) != len(set(ranked)):
        raise AppError(ErrorCode.VALIDATION_ERROR, "排序選項不可重複")

    valid_ids = await _get_valid_option_ids(db, interaction.id)
    if not valid_ids:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此 Poll 尚無選項")
    invalid = [oid for oid in ranked if oid not in valid_ids]
    if invalid:
        raise AppError(ErrorCode.VALIDATION_ERROR, "含有無效的選項")

    required = settings.top_n if settings.top_n is not None else len(valid_ids)
    if len(ranked) != required:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"須排序 {required} 個選項",
        )

    existing = await _get_single_submission(db, interaction.id, participant_id)
    if existing is not None:
        raise AppError(ErrorCode.ALREADY_RESPONDED, "您已提交過排序")

    now = dt.datetime.now(dt.UTC)
    answer_data = {"ranked_option_ids": [str(oid) for oid in ranked]}
    db.add(
        PollResponse(
            id=uuid7(),
            interaction_id=interaction.id,
            participant_id=participant_id,
            answer_jsonb=answer_data,
            submission_no=0,
            idempotency_key=idempotency_key,
            submitted_at=now,
        )
    )
    await db.commit()

    n = len(ranked)
    if settings.ranking_mode == "borda":
        for i, oid in enumerate(ranked):
            points = n - 1 - i
            await increment_option_count(interaction.id, str(oid), delta=points)

    _, id_to_index, _ = await _get_ranking_option_maps(db, interaction.id)
    order_key = _ranking_order_key(ranked, id_to_index)
    await increment_option_count(interaction.id, f"order:{order_key}", delta=1)

    return await _finish_submit_broadcast(db, interaction)


# ── 結果（GET /polls/{id}/results；鐵律 2 後端聚合）──────────────────


async def get_poll_results(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    *,
    is_host: bool,
) -> PollResults:
    """讀取結果；participant 受 ``result_visible`` 控制。"""
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id)
    )
    interaction = result.scalars().first()
    if interaction is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    if interaction.type not in POLL_TYPES:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此互動項目不是 Poll 題型")

    if not is_host and not interaction.result_visible:
        raise AppError(ErrorCode.FORBIDDEN, "結果尚未揭示")

    response_count = await _count_responses(db, interaction_id)
    itype = interaction.type

    if itype == InteractionType.MULTIPLE_CHOICE:
        return PollResults(
            interaction_id=interaction_id,
            type=itype,
            status=interaction.status,
            response_count=response_count,
            option_counts=await _get_mc_option_counts(db, interaction_id),
        )
    if itype == InteractionType.WORD_CLOUD:
        return PollResults(
            interaction_id=interaction_id,
            type=itype,
            status=interaction.status,
            response_count=response_count,
            word_counts=await _get_word_counts(db, interaction_id),
        )
    if itype == InteractionType.RATING:
        average, distribution = await _get_rating_results(db, interaction_id)
        return PollResults(
            interaction_id=interaction_id,
            type=itype,
            status=interaction.status,
            response_count=response_count,
            average=average,
            distribution=distribution,
        )
    if itype == InteractionType.OPEN_TEXT:
        settings = cast(
            OpenTextSettings,
            parse_settings(InteractionType.OPEN_TEXT, interaction.settings_jsonb),
        )
        entries = await _get_open_text_entries(
            db, interaction_id, settings=settings, is_host=is_host
        )
        return PollResults(
            interaction_id=interaction_id,
            type=itype,
            status=interaction.status,
            response_count=response_count,
            entries=entries,
        )
    if itype == InteractionType.RANKING:
        ranking_settings = cast(
            RankingSettings,
            parse_settings(InteractionType.RANKING, interaction.settings_jsonb),
        )
        order_counts = await _get_ranking_order_counts(db, interaction_id)
        if ranking_settings.ranking_mode == "borda":
            counts = await _get_mc_option_counts(db, interaction_id)
        else:
            counts = await _get_ranking_average_counts(db, interaction_id)
        return PollResults(
            interaction_id=interaction_id,
            type=itype,
            status=interaction.status,
            response_count=response_count,
            option_counts=counts,
            ranking_order_counts=order_counts,
        )

    raise AppError(ErrorCode.VALIDATION_ERROR, f"題型 {itype} 不支援結果查詢")


# ── 作答／結果共用輔助 ─────────────────────────────────────────────


def _parse_answer_typed(
    itype: InteractionType, payload: PollSubmitRequest
) -> object:
    try:
        return parse_answer(itype, payload.answer)
    except ValueError as exc:
        raise AppError(ErrorCode.VALIDATION_ERROR, str(exc)) from exc


async def _count_participant_submissions(
    db: AsyncSession, interaction_id: uuid.UUID, participant_id: uuid.UUID
) -> int:
    result = await db.execute(
        select(func.count())
        .select_from(PollResponse)
        .where(
            PollResponse.interaction_id == interaction_id,
            PollResponse.participant_id == participant_id,
        )
    )
    return int(result.scalar_one())


async def _next_submission_no(
    db: AsyncSession, interaction_id: uuid.UUID, participant_id: uuid.UUID
) -> int:
    result = await db.execute(
        select(func.coalesce(func.max(PollResponse.submission_no), -1)).where(
            PollResponse.interaction_id == interaction_id,
            PollResponse.participant_id == participant_id,
        )
    )
    return int(result.scalar_one()) + 1


async def _get_single_submission(
    db: AsyncSession, interaction_id: uuid.UUID, participant_id: uuid.UUID
) -> PollResponse | None:
    result = await db.execute(
        select(PollResponse).where(
            PollResponse.interaction_id == interaction_id,
            PollResponse.participant_id == participant_id,
            PollResponse.submission_no == 0,
        )
    )
    return result.scalar_one_or_none()


async def _finish_submit_broadcast(
    db: AsyncSession,
    interaction: Interaction,
    *,
    submission_no: int | None = None,
) -> PollSubmitResult:
    if submission_no is None:
        submission_no = 0
    response_count = await _count_responses(db, interaction.id)
    payload = await _build_broadcast_payload(db, interaction, response_count)
    await throttled_broadcast_result(
        interaction.room_id, interaction.id, payload
    )
    return PollSubmitResult(
        interaction_id=interaction.id,
        submission_no=submission_no,
        accepted=True,
    )


async def _build_broadcast_payload(
    db: AsyncSession,
    interaction: Interaction,
    response_count: int,
) -> dict[str, Any]:
    itype = interaction.type
    base: dict[str, Any] = {
        "poll_id": str(interaction.id),
        "response_count": response_count,
        "aggregates": {},
    }
    if itype == InteractionType.MULTIPLE_CHOICE:
        counts = await _get_mc_option_counts(db, interaction.id)
        base["aggregates"]["option_counts"] = [
            {"option_id": str(oc.option_id), "count": oc.count} for oc in counts
        ]
    elif itype == InteractionType.WORD_CLOUD:
        words = await _get_word_counts(db, interaction.id)
        base["aggregates"]["word_counts"] = [
            {"word": wc.word, "count": wc.count} for wc in words
        ]
    elif itype == InteractionType.RATING:
        avg, dist = await _get_rating_results(db, interaction.id)
        base["aggregates"]["average"] = avg
        base["aggregates"]["distribution"] = dist
    elif itype == InteractionType.RANKING:
        settings = cast(
            RankingSettings,
            parse_settings(InteractionType.RANKING, interaction.settings_jsonb),
        )
        order_counts = await _get_ranking_order_counts(db, interaction.id)
        base["aggregates"]["ranking_order_counts"] = [
            {
                "order_key": oc.order_key,
                "order_labels": oc.order_labels,
                "count": oc.count,
                "percentage": oc.percentage,
            }
            for oc in order_counts
        ]
        if settings.ranking_mode == "borda":
            counts = await _get_mc_option_counts(db, interaction.id)
        else:
            counts = await _get_ranking_average_counts(db, interaction.id)
        base["aggregates"]["option_counts"] = [
            {"option_id": str(oc.option_id), "count": oc.count} for oc in counts
        ]
    return base


def _is_uuid_field(key: str) -> bool:
    try:
        uuid.UUID(key)
        return True
    except ValueError:
        return False


async def _count_responses(db: AsyncSession, interaction_id: uuid.UUID) -> int:
    agg = await get_poll_agg(interaction_id)
    raw = agg.get("count")
    if raw is not None and str(raw).isdigit():
        return int(raw)
    result = await db.execute(
        select(func.count())
        .select_from(PollResponse)
        .where(PollResponse.interaction_id == interaction_id)
    )
    return int(result.scalar_one())


async def _get_valid_option_ids(
    db: AsyncSession, interaction_id: uuid.UUID
) -> set[uuid.UUID]:
    result = await db.execute(
        select(PollOption.id).where(PollOption.interaction_id == interaction_id)
    )
    return set(result.scalars().all())


async def _get_mc_option_counts(
    db: AsyncSession, interaction_id: uuid.UUID
) -> list[OptionCount]:
    """先讀 Redis agg，無資料則從 DB 聚合。"""
    agg = await get_poll_agg(interaction_id)
    option_keys = {
        k: int(v)
        for k, v in agg.items()
        if k not in ("sum", "count")
        and not k.startswith("r:")
        and _is_uuid_field(k)
        and v.lstrip("-").isdigit()
    }
    if option_keys:
        return [
            OptionCount(option_id=uuid.UUID(oid), count=cnt)
            for oid, cnt in option_keys.items()
            if cnt > 0
        ]

    counts = await _aggregate_mc_from_db(db, interaction_id)
    return [
        OptionCount(option_id=uuid.UUID(oid), count=cnt)
        for oid, cnt in counts.items()
        if cnt > 0
    ]


async def _aggregate_mc_from_db(
    db: AsyncSession, interaction_id: uuid.UUID
) -> dict[str, int]:
    result = await db.execute(
        select(PollResponse.answer_jsonb).where(
            PollResponse.interaction_id == interaction_id
        )
    )
    counts: dict[str, int] = {}
    for row in result.all():
        answer = row[0]
        for oid in answer.get("option_ids", []):
            key = str(oid)
            counts[key] = counts.get(key, 0) + 1
        ranked = answer.get("ranked_option_ids", [])
        if ranked:
            n = len(ranked)
            for i, oid in enumerate(ranked):
                key = str(oid)
                counts[key] = counts.get(key, 0) + (n - 1 - i)
    return counts


async def _get_word_counts(
    db: AsyncSession, interaction_id: uuid.UUID
) -> list[WordCount]:
    agg = await get_poll_agg(interaction_id)
    word_keys = {
        k: int(v)
        for k, v in agg.items()
        if k not in ("sum", "count")
        and not k.startswith("r:")
        and not _is_uuid_field(k)
        and v.isdigit()
    }
    if word_keys:
        return [
            WordCount(word=word, count=cnt)
            for word, cnt in sorted(word_keys.items(), key=lambda x: -x[1])
        ]

    counts, display = await _aggregate_words_from_db(db, interaction_id)
    return [
        WordCount(word=display.get(w, w), count=cnt)
        for w, cnt in sorted(counts.items(), key=lambda x: -x[1])
    ]


async def _aggregate_words_from_db(
    db: AsyncSession, interaction_id: uuid.UUID
) -> tuple[dict[str, int], dict[str, str]]:
    result = await db.execute(
        select(PollResponse.answer_jsonb).where(
            PollResponse.interaction_id == interaction_id
        )
    )
    counts: dict[str, int] = {}
    display: dict[str, str] = {}
    for row in result.all():
        for word in row[0].get("words", []):
            key = str(word).casefold()
            counts[key] = counts.get(key, 0) + 1
            display.setdefault(key, str(word))
    return counts, display


async def _get_rating_results(
    db: AsyncSession, interaction_id: uuid.UUID
) -> tuple[float | None, dict[int, int] | None]:
    agg = await get_poll_agg(interaction_id)
    total_sum = agg.get("sum")
    total_count = agg.get("count")
    if total_sum is not None and total_count is not None:
        count = int(total_count)
        if count > 0:
            distribution = {
                int(k[2:]): int(v)
                for k, v in agg.items()
                if k.startswith("r:") and v.isdigit()
            }
            return int(total_sum) / count, distribution or None

    result = await db.execute(
        select(PollResponse.answer_jsonb).where(
            PollResponse.interaction_id == interaction_id,
            PollResponse.submission_no == 0,
        )
    )
    values: list[int] = []
    for row in result.all():
        val = row[0].get("value")
        if isinstance(val, int):
            values.append(val)
    if not values:
        return None, None
    rating_distribution: dict[int, int] = {}
    for v in values:
        rating_distribution[v] = rating_distribution.get(v, 0) + 1
    return sum(values) / len(values), rating_distribution


async def _get_open_text_entries(
    db: AsyncSession,
    interaction_id: uuid.UUID,
    *,
    settings: OpenTextSettings,
    is_host: bool,
) -> list[TextEntry]:
    result = await db.execute(
        select(PollResponse, Participant)
        .join(Participant, PollResponse.participant_id == Participant.id)
        .where(PollResponse.interaction_id == interaction_id)
    )
    rows = list(result.all())
    if settings.sort == "oldest":
        rows.sort(key=lambda r: r[0].submitted_at)
    else:
        rows.sort(key=lambda r: r[0].submitted_at, reverse=True)

    entries: list[TextEntry] = []
    for response, participant in rows:
        text = str(response.answer_jsonb.get("text", ""))
        author_display = _author_display(participant, settings, is_host=is_host)
        entries.append(
            TextEntry(
                id=response.id,
                text=text,
                author_display=author_display,
                created_at=response.submitted_at,
            )
        )
    return entries


def _author_display(
    participant: Participant,
    settings: OpenTextSettings,
    *,
    is_host: bool,
) -> str | None:
    if not settings.show_voter_names and not is_host:
        return None
    masked = mask_identity(
        {
            "display_name": participant.display_name,
            "email": participant.email,
            "is_anonymous": participant.is_anonymous,
            "participant_id": str(participant.id),
        }
    )
    return masked.get("display_name")


async def _get_ranking_option_maps(
    db: AsyncSession, interaction_id: uuid.UUID
) -> tuple[list[PollOption], dict[uuid.UUID, int], dict[uuid.UUID, str]]:
    """依 order_no 建立選項 1-based 索引（排序組合 key 用）。"""
    result = await db.execute(
        select(PollOption)
        .where(PollOption.interaction_id == interaction_id)
        .order_by(PollOption.order_no)
    )
    options = list(result.scalars().all())
    id_to_index = {opt.id: i + 1 for i, opt in enumerate(options)}
    id_to_text = {opt.id: opt.text for opt in options}
    return options, id_to_index, id_to_text


def _ranking_order_key(
    ranked: list[uuid.UUID | str], id_to_index: dict[uuid.UUID, int]
) -> str:
    indices: list[str] = []
    for oid in ranked:
        uid = oid if isinstance(oid, uuid.UUID) else uuid.UUID(str(oid))
        indices.append(str(id_to_index[uid]))
    return ",".join(indices)


def _labels_from_order_key(order_key: str, options: list[PollOption]) -> list[str]:
    labels: list[str] = []
    for part in order_key.split(","):
        if not part.isdigit():
            continue
        idx = int(part) - 1
        if 0 <= idx < len(options):
            labels.append(options[idx].text)
    return labels


async def _get_ranking_order_counts(
    db: AsyncSession, interaction_id: uuid.UUID
) -> list[RankingOrderCount]:
    """排序題：統計每種完整排列組合的票數與佔比。"""
    options, id_to_index, _ = await _get_ranking_option_maps(db, interaction_id)
    if not options:
        return []

    perm_counts: dict[str, int] = {}
    agg = await get_poll_agg(interaction_id)
    for key, value in agg.items():
        if key.startswith("order:") and value.lstrip("-").isdigit():
            perm_counts[key[6:]] = int(value)

    if not perm_counts:
        result = await db.execute(
            select(PollResponse.answer_jsonb).where(
                PollResponse.interaction_id == interaction_id
            )
        )
        for row in result.all():
            ranked = row[0].get("ranked_option_ids", [])
            if not ranked:
                continue
            try:
                order_key = _ranking_order_key(ranked, id_to_index)
            except (KeyError, ValueError):
                continue
            perm_counts[order_key] = perm_counts.get(order_key, 0) + 1

    total = sum(perm_counts.values())
    if total == 0:
        return []

    items: list[RankingOrderCount] = []
    for order_key, count in sorted(perm_counts.items(), key=lambda x: -x[1]):
        percentage = round(count / total * 100, 1)
        items.append(
            RankingOrderCount(
                order_key=order_key,
                order_labels=_labels_from_order_key(order_key, options),
                count=count,
                percentage=percentage,
            )
        )
    return items


async def _get_ranking_average_counts(
    db: AsyncSession, interaction_id: uuid.UUID
) -> list[OptionCount]:
    """average 模式：選項平均名次愈小愈好，輸出為倒數名次分數（愈高愈好）。"""
    result = await db.execute(
        select(PollResponse.answer_jsonb).where(
            PollResponse.interaction_id == interaction_id
        )
    )
    position_sums: dict[str, float] = {}
    position_counts: dict[str, int] = {}
    for row in result.all():
        ranked = row[0].get("ranked_option_ids", [])
        for i, oid in enumerate(ranked):
            key = str(oid)
            position_sums[key] = position_sums.get(key, 0.0) + (i + 1)
            position_counts[key] = position_counts.get(key, 0) + 1

    scores: list[tuple[uuid.UUID, int]] = []
    for oid, total in position_sums.items():
        cnt = position_counts[oid]
        avg_rank = total / cnt
        # 轉為可排序分數：平均名次愈低分數愈高
        score = max(0, int(round(1000 / avg_rank)))
        scores.append((uuid.UUID(oid), score))
    scores.sort(key=lambda x: -x[1])
    return [OptionCount(option_id=oid, count=score) for oid, score in scores]
