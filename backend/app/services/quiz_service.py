"""Quiz 控場與作答業務邏輯（BE-007、FE-011；SDS §4.5 計分）。

每題對應一個 child ``multiple_choice`` interaction + ``QuizQuestion`` 列。
狀態機：pending → active → revealed → closed。
"""

from __future__ import annotations

import datetime as dt
import math
import uuid
from decimal import Decimal
from typing import Any, cast

from sqlalchemy import func, select, delete
from sqlalchemy import update as sa_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.models.enums import InteractionStatus, InteractionType, QuizQuestionState
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollOption
from app.models.room import Room
from app.models.sprint9 import QuizQuestion, QuizResponse
from app.models.user import User
from app.realtime import events
from app.schemas.poll import PollOptionPublic
from app.schemas.quiz import (
    LeaderboardEntry,
    QuizAction,
    QuizActionRequest,
    QuizActionResponse,
    QuizAnswerResult,
    QuizAnswerSubmitRequest,
    QuizLeaderboardResponse,
    QuizQuestionCreateRequest,
    QuizQuestionPublic,
    QuizQuestionUpdateRequest,
)
from app.services import audit_service, interaction_service

_GRACE_S = 2


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


async def _load_quiz_for_host(
    db: AsyncSession, quiz_interaction_id: uuid.UUID, host: User
) -> tuple[Interaction, uuid.UUID]:
    """載入 Quiz 父 interaction 並驗 host 權限。"""
    result = await db.execute(
        select(Interaction, Room)
        .join(Room, Interaction.room_id == Room.id)
        .where(Interaction.id == quiz_interaction_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    interaction, room = row[0], row[1]
    await interaction_service.ensure_room_access(db, room.id, host)
    if interaction.type != InteractionType.QUIZ:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此互動項目不是 Quiz")
    return interaction, room.id


async def _load_quiz_question(
    db: AsyncSession, question_id: uuid.UUID
) -> QuizQuestion:
    result = await db.execute(
        select(QuizQuestion).where(QuizQuestion.id == question_id)
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 Quiz 子題")
    return question


async def _get_child_interaction(
    db: AsyncSession, child_id: uuid.UUID
) -> Interaction:
    result = await db.execute(
        select(Interaction).where(Interaction.id == child_id)
    )
    child = result.scalar_one_or_none()
    if child is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到子題互動項目")
    return child


async def _question_options(
    db: AsyncSession,
    child_interaction_id: uuid.UUID,
    *,
    hide_correct: bool,
) -> list[PollOptionPublic]:
    result = await db.execute(
        select(PollOption)
        .where(PollOption.interaction_id == child_interaction_id)
        .order_by(PollOption.order_no)
    )
    return [
        PollOptionPublic(
            id=opt.id,
            text=opt.text,
            order_no=opt.order_no,
            is_correct=None if hide_correct else opt.is_correct,
        )
        for opt in result.scalars().all()
    ]


def _to_question_public(
    qq: QuizQuestion,
    child: Interaction,
    options: list[PollOptionPublic],
) -> QuizQuestionPublic:
    return QuizQuestionPublic(
        id=qq.id,
        quiz_interaction_id=qq.quiz_interaction_id,
        child_interaction_id=qq.child_interaction_id,
        title=child.title,
        time_limit_s=qq.time_limit_s,
        base_points=qq.base_points,
        speed_bonus=qq.speed_bonus,
        explanation=qq.explanation,
        order_no=qq.order_no,
        state=qq.state,
        started_at=qq.started_at,
        options=options,
    )


async def add_question(
    db: AsyncSession,
    *,
    quiz_interaction_id: uuid.UUID,
    host: User,
    payload: QuizQuestionCreateRequest,
) -> QuizQuestionPublic:
    """新增 Quiz 子題：建立 child multiple_choice + 選項 + QuizQuestion。"""
    quiz, room_id = await _load_quiz_for_host(db, quiz_interaction_id, host)

    max_order = await db.execute(
        select(func.coalesce(func.max(QuizQuestion.order_no), -1)).where(
            QuizQuestion.quiz_interaction_id == quiz_interaction_id
        )
    )
    next_order = int(max_order.scalar_one()) + 1
    now = dt.datetime.now(dt.UTC)

    child = Interaction(
        id=uuid7(),
        room_id=quiz.room_id,
        type=InteractionType.MULTIPLE_CHOICE,
        title=payload.title,
        description=payload.description,
        status=InteractionStatus.IDLE,
        order_no=next_order,
        settings_jsonb={
            "multi_select": False,
            "min_select": 1,
            "max_select": 1,
            "has_correct": True,
            "allow_change": False,
            "show_result": False,
        },
        result_visible=False,
        created_by=host.id,
    )
    db.add(child)
    await db.flush()

    for i, opt in enumerate(payload.options):
        db.add(
            PollOption(
                id=uuid7(),
                interaction_id=child.id,
                text=opt.text,
                is_correct=opt.is_correct,
                order_no=opt.order_no if opt.order_no else i,
                created_at=now,
            )
        )

    qq = QuizQuestion(
        id=uuid7(),
        quiz_interaction_id=quiz_interaction_id,
        child_interaction_id=child.id,
        time_limit_s=payload.time_limit_s,
        base_points=payload.base_points,
        speed_bonus=payload.speed_bonus,
        explanation=payload.explanation,
        order_no=next_order,
        state=QuizQuestionState.PENDING,
        created_at=now,
    )
    db.add(qq)
    await audit_service.log(
        db,
        actor=host,
        action="quiz.add_question",
        target_type="quiz_question",
        target_id=qq.id,
        room_id=room_id,
    )
    await db.commit()
    await db.refresh(qq)
    await db.refresh(child)

    options = await _question_options(db, child.id, hide_correct=True)
    return _to_question_public(qq, child, options)


async def list_questions(
    db: AsyncSession,
    *,
    quiz_interaction_id: uuid.UUID,
    host: User,
    hide_correct: bool = True,
) -> list[QuizQuestionPublic]:
    """列出 Quiz 全部子題（Host）。"""
    await _load_quiz_for_host(db, quiz_interaction_id, host)
    result = await db.execute(
        select(QuizQuestion, Interaction)
        .join(Interaction, QuizQuestion.child_interaction_id == Interaction.id)
        .where(QuizQuestion.quiz_interaction_id == quiz_interaction_id)
        .order_by(QuizQuestion.order_no)
    )
    items: list[QuizQuestionPublic] = []
    for qq, child in result.all():
        options = await _question_options(
            db, child.id, hide_correct=hide_correct and qq.state != QuizQuestionState.REVEALED
        )
        items.append(_to_question_public(qq, child, options))
    return items


async def _upsert_child_options(
    db: AsyncSession,
    child_interaction_id: uuid.UUID,
    option_payloads: list[dict[str, Any]],
) -> None:
    await db.execute(
        delete(PollOption).where(PollOption.interaction_id == child_interaction_id)
    )
    now = dt.datetime.now(dt.UTC)
    for i, p in enumerate(option_payloads):
        db.add(
            PollOption(
                id=uuid7(),
                interaction_id=child_interaction_id,
                text=str(p.get("text", "")),
                is_correct=bool(p.get("is_correct", False)),
                order_no=int(p.get("order_no", i)),
                created_at=now,
            )
        )


async def update_question(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    host: User,
    payload: QuizQuestionUpdateRequest,
) -> QuizQuestionPublic:
    """更新 Quiz 子題（僅 pending）。"""
    qq = await _load_quiz_question(db, question_id)
    if qq.state != QuizQuestionState.PENDING:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "僅待開始的子題可編輯",
        )
    await _load_quiz_for_host(db, qq.quiz_interaction_id, host)
    child = await _get_child_interaction(db, qq.child_interaction_id)

    if payload.title is not None:
        child.title = payload.title
    if payload.description is not None:
        child.description = payload.description
    if payload.time_limit_s is not None:
        qq.time_limit_s = payload.time_limit_s
    if payload.base_points is not None:
        qq.base_points = payload.base_points
    if payload.speed_bonus is not None:
        qq.speed_bonus = payload.speed_bonus
    if payload.explanation is not None:
        qq.explanation = payload.explanation
    if payload.options is not None:
        await _upsert_child_options(
            db,
            child.id,
            [opt.model_dump() for opt in payload.options],
        )

    await db.commit()
    await db.refresh(qq)
    await db.refresh(child)
    options = await _question_options(db, child.id, hide_correct=True)
    return _to_question_public(qq, child, options)


async def delete_question(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    host: User,
) -> None:
    """刪除 Quiz 子題（僅 pending）。"""
    qq = await _load_quiz_question(db, question_id)
    if qq.state != QuizQuestionState.PENDING:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "僅待開始的子題可刪除",
        )
    await _load_quiz_for_host(db, qq.quiz_interaction_id, host)
    child_id = qq.child_interaction_id
    await db.execute(
        delete(PollOption).where(PollOption.interaction_id == child_id)
    )
    await db.delete(qq)
    await db.execute(delete(Interaction).where(Interaction.id == child_id))
    await db.commit()


async def get_leaderboard(
    db: AsyncSession,
    *,
    quiz_interaction_id: uuid.UUID,
    host: User | None = None,
) -> QuizLeaderboardResponse:
    """排行榜：總分 DESC → 累計 elapsed ASC。"""
    if host is not None:
        await _load_quiz_for_host(db, quiz_interaction_id, host)

    agg = await db.execute(
        select(
            QuizResponse.participant_id,
            func.sum(QuizResponse.score).label("total_score"),
            func.sum(QuizResponse.elapsed_ms).label("total_elapsed"),
        )
        .join(QuizQuestion, QuizResponse.quiz_question_id == QuizQuestion.id)
        .where(QuizQuestion.quiz_interaction_id == quiz_interaction_id)
        .group_by(QuizResponse.participant_id)
        .order_by(
            func.sum(QuizResponse.score).desc(),
            func.sum(QuizResponse.elapsed_ms).asc(),
        )
    )
    rows = agg.all()
    if not rows:
        return QuizLeaderboardResponse(
            quiz_interaction_id=quiz_interaction_id, entries=[]
        )

    participant_ids = [r[0] for r in rows]
    names_result = await db.execute(
        select(Participant.id, Participant.display_name).where(
            Participant.id.in_(participant_ids)
        )
    )
    names = {pid: name for pid, name in names_result.all()}

    entries: list[LeaderboardEntry] = []
    for rank, (pid, total_score, total_elapsed) in enumerate(rows, start=1):
        entries.append(
            LeaderboardEntry(
                participant_id=pid,
                display_name=names.get(pid),
                total_score=Decimal(str(total_score or 0)),
                total_elapsed_ms=int(total_elapsed or 0),
                rank=rank,
            )
        )
    return QuizLeaderboardResponse(
        quiz_interaction_id=quiz_interaction_id, entries=entries
    )


async def _close_active_siblings(
    db: AsyncSession, quiz_interaction_id: uuid.UUID, except_id: uuid.UUID | None
) -> None:
    """關閉同 Quiz 內其他 active/revealed 子題。"""
    stmt = select(QuizQuestion).where(
        QuizQuestion.quiz_interaction_id == quiz_interaction_id,
        QuizQuestion.state.in_(
            [QuizQuestionState.ACTIVE, QuizQuestionState.REVEALED]
        ),
    )
    if except_id is not None:
        stmt = stmt.where(QuizQuestion.id != except_id)
    result = await db.execute(stmt)
    now = dt.datetime.now(dt.UTC)
    for qq in result.scalars().all():
        qq.state = QuizQuestionState.CLOSED
        await db.execute(
            sa_update(Interaction)
            .where(Interaction.id == qq.child_interaction_id)
            .values(
                status=InteractionStatus.STOPPED,
                stopped_at=now,
                updated_at=now,
            )
        )


async def _start_child_poll(
    db: AsyncSession, child: Interaction, qq: QuizQuestion
) -> None:
    now = dt.datetime.now(dt.UTC)
    qq.state = QuizQuestionState.ACTIVE
    qq.started_at = now
    child.status = InteractionStatus.ACTIVE
    child.started_at = now
    child.result_visible = False


async def _publish_leaderboard(
    db: AsyncSession, quiz_interaction_id: uuid.UUID, room_id: uuid.UUID
) -> None:
    board = await get_leaderboard(db, quiz_interaction_id=quiz_interaction_id)
    await events.publish(
        room_id,
        events.QUIZ_LEADERBOARD_UPDATED,
        {
            "quiz_id": str(quiz_interaction_id),
            "entries": [e.model_dump(mode="json") for e in board.entries],
        },
    )


async def quiz_action(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    host: User,
    request: QuizActionRequest,
) -> QuizActionResponse:
    """Quiz 控場：start_question / reveal / next / close。"""
    qq = await _load_quiz_question(db, question_id)
    quiz, room_id = await _load_quiz_for_host(db, qq.quiz_interaction_id, host)
    child = await _get_child_interaction(db, qq.child_interaction_id)
    action = request.action

    if action == QuizAction.START_QUESTION:
        if qq.state != QuizQuestionState.PENDING:
            raise AppError(
                ErrorCode.POLL_INVALID_STATE,
                f"start_question 僅允許 pending 狀態（目前 {qq.state}）",
            )
        await _close_active_siblings(db, qq.quiz_interaction_id, except_id=qq.id)
        await _start_child_poll(db, child, qq)
        options = await _question_options(db, child.id, hide_correct=True)
        await events.publish(
            room_id,
            events.QUIZ_QUESTION_STARTED,
            {
                "quiz_id": str(quiz.id),
                "question": _to_question_public(qq, child, options).model_dump(
                    mode="json"
                ),
            },
        )

    elif action == QuizAction.REVEAL:
        if qq.state != QuizQuestionState.ACTIVE:
            raise AppError(
                ErrorCode.POLL_INVALID_STATE,
                f"reveal 僅允許 active 狀態（目前 {qq.state}）",
            )
        qq.state = QuizQuestionState.REVEALED
        child.result_visible = True
        child.status = InteractionStatus.LOCKED
        correct_ids = await _get_correct_option_ids(db, child.id)
        await events.publish(
            room_id,
            events.POLL_RESULT_REVEALED,
            {
                "poll_id": str(child.id),
                "correct_option_ids": [str(oid) for oid in correct_ids],
            },
        )

    elif action == QuizAction.CLOSE:
        if qq.state not in (QuizQuestionState.ACTIVE, QuizQuestionState.REVEALED):
            raise AppError(
                ErrorCode.POLL_INVALID_STATE,
                f"close 僅允許 active/revealed 狀態（目前 {qq.state}）",
            )
        now = dt.datetime.now(dt.UTC)
        qq.state = QuizQuestionState.CLOSED
        child.status = InteractionStatus.STOPPED
        child.stopped_at = now

    elif action == QuizAction.NEXT:
        if qq.state in (QuizQuestionState.ACTIVE, QuizQuestionState.REVEALED):
            now = dt.datetime.now(dt.UTC)
            qq.state = QuizQuestionState.CLOSED
            child.status = InteractionStatus.STOPPED
            child.stopped_at = now

        next_result = await db.execute(
            select(QuizQuestion)
            .where(
                QuizQuestion.quiz_interaction_id == qq.quiz_interaction_id,
                QuizQuestion.state == QuizQuestionState.PENDING,
                QuizQuestion.order_no > qq.order_no,
            )
            .order_by(QuizQuestion.order_no)
            .limit(1)
        )
        next_qq = next_result.scalar_one_or_none()
        if next_qq is not None:
            next_child = await _get_child_interaction(db, next_qq.child_interaction_id)
            await _close_active_siblings(
                db, qq.quiz_interaction_id, except_id=next_qq.id
            )
            await _start_child_poll(db, next_child, next_qq)
            qq = next_qq
            child = next_child
            options = await _question_options(db, child.id, hide_correct=True)
            await events.publish(
                room_id,
                events.QUIZ_QUESTION_STARTED,
                {
                    "quiz_id": str(quiz.id),
                    "question": _to_question_public(qq, child, options).model_dump(
                        mode="json"
                    ),
                },
            )
    else:
        raise AppError(ErrorCode.VALIDATION_ERROR, f"不支援的動作：{action}")

    await audit_service.log(
        db,
        actor=host,
        action=f"quiz.{action}",
        target_type="quiz_question",
        target_id=question_id,
        room_id=room_id,
    )
    await db.commit()
    await db.refresh(qq)
    await db.refresh(child)
    return QuizActionResponse(
        question_id=qq.id,
        state=qq.state,
        child_status=child.status,
    )


def _calculate_score(
    *,
    base_points: int,
    elapsed_ms: int,
    time_limit_s: int,
    speed_bonus: bool,
    is_correct: bool,
) -> Decimal:
    """SDS §4.5：答對速度加權；答錯 0。"""
    if not is_correct:
        return Decimal(0)
    if not speed_bonus:
        return Decimal(base_points)
    limit_ms = max(time_limit_s * 1000, 1)
    factor = 1 - (elapsed_ms / limit_ms * 0.5)
    return Decimal(max(0, math.floor(base_points * factor)))


async def submit_answer(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: QuizAnswerSubmitRequest,
) -> QuizAnswerResult:
    """提交 Quiz 作答（限時 +2s grace）。"""
    qq = await _load_quiz_question(db, question_id)
    if qq.state != QuizQuestionState.ACTIVE:
        raise AppError(
            ErrorCode.POLL_INVALID_STATE,
            "僅 active 狀態可作答",
        )
    if qq.started_at is None:
        raise AppError(ErrorCode.POLL_INVALID_STATE, "子題尚未開始計時")

    child = await _get_child_interaction(db, qq.child_interaction_id)
    part_check = await db.execute(
        select(Participant.id).where(
            Participant.id == participant_id,
            Participant.room_id == child.room_id,
        )
    )
    if part_check.scalar_one_or_none() is None:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此房間")

    now = dt.datetime.now(dt.UTC)
    elapsed_ms = int((now - qq.started_at).total_seconds() * 1000)
    max_ms = (qq.time_limit_s + _GRACE_S) * 1000
    if elapsed_ms > max_ms:
        raise AppError(ErrorCode.POLL_INVALID_STATE, "作答時間已逾時")

    existing = await db.execute(
        select(QuizResponse).where(
            QuizResponse.quiz_question_id == question_id,
            QuizResponse.participant_id == participant_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise AppError(ErrorCode.ALREADY_RESPONDED, "您已提交過此題答案")

    option_id = payload.option_ids[0]
    correct_ids = await _get_correct_option_ids(db, child.id)
    valid = await db.execute(
        select(PollOption.id).where(PollOption.interaction_id == child.id)
    )
    valid_ids = {row[0] for row in valid.all()}
    if option_id not in valid_ids:
        raise AppError(ErrorCode.VALIDATION_ERROR, "無效的選項")

    is_correct = option_id in correct_ids
    score = _calculate_score(
        base_points=qq.base_points,
        elapsed_ms=elapsed_ms,
        time_limit_s=qq.time_limit_s,
        speed_bonus=qq.speed_bonus,
        is_correct=is_correct,
    )

    db.add(
        QuizResponse(
            id=uuid7(),
            quiz_question_id=question_id,
            participant_id=participant_id,
            answer_jsonb={"option_ids": [str(option_id)]},
            elapsed_ms=elapsed_ms,
            is_correct=is_correct,
            score=score,
            submitted_at=now,
        )
    )
    await db.commit()

    quiz_result = await db.execute(
        select(Interaction.room_id).where(
            Interaction.id == qq.quiz_interaction_id
        )
    )
    room_id = cast(uuid.UUID, quiz_result.scalar_one())
    await _publish_leaderboard(db, qq.quiz_interaction_id, room_id)

    explanation = qq.explanation if is_correct or qq.state == QuizQuestionState.REVEALED else None
    return QuizAnswerResult(
        quiz_question_id=question_id,
        is_correct=is_correct,
        score=score,
        elapsed_ms=elapsed_ms,
        explanation=explanation,
    )
