"""Q&A 業務邏輯（FE-004／FE-005、BE-004、SDS §5.5）。

鐵律落點：
- 寫入走 REST，WS 只廣播（鐵律 1）。
- 計數一律後端聚合，事件 payload 帶絕對值（鐵律 2）。
- 匿名遮蔽只在 ``mask_identity``（鐵律 3）。
- upvote 唯一性以 ``(question_id, participant_id)`` 約束（FE-005-AC6）。

刻意延後（Sprint 3）：Redis 計數節流與週期回寫、廣播節流（≥300ms 合併）、
rate limit、audit log 持久化、相似問題偵測、Question AI。
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.tokens import ParticipantTokenClaims
from app.models.enums import (
    InteractionStatus,
    QuestionStatus,
    ReplyAuthorType,
)
from app.models.participant import Participant
from app.models.question import Question, QuestionReply, QuestionVote
from app.models.user import User
from app.realtime import events
from app.schemas.interaction import QaSettings
from app.schemas.question import (
    MergedQuestionItem,
    ModerateAction,
    QuestionCreateRequest,
    QuestionListResponse,
    QuestionPublic,
    ReplyCreateRequest,
    ReplyResponse,
    VoteDirection,
    VoteResult,
)
from app.serializers.mask_identity import mask_identity
from app.schemas.ai import (
    AiConfigOverride,
    AiDedupQuestionsResponse,
    MergeQuestionsRequest,
    MergeQuestionsResponse,
    UnmergeQuestionResponse,
)
from app.services import (
    ai_service,
    audit_service,
    rate_limit_service,
    interaction_service,
    qa_redis,
)

_DEFAULT_PAGE_SIZE = 50
_VOTABLE_STATUSES = {QuestionStatus.APPROVED, QuestionStatus.ANSWERED}
_PUBLIC_LIST_STATUSES = {QuestionStatus.APPROVED, QuestionStatus.ANSWERED}


def _qa_settings(interaction_settings: dict[str, object] | None) -> QaSettings:
    return QaSettings.model_validate(interaction_settings or {})


def _author_display(*, is_anonymous: bool, display_name: str | None) -> str | None:
    """經 mask_identity 取得對外顯示名（鐵律 3）。"""
    masked = mask_identity(
        {"is_anonymous": is_anonymous, "display_name": display_name}
    )
    return masked.get("display_name")


def _to_public(
    question: Question,
    *,
    display_name: str | None,
    my_vote: VoteDirection | None = None,
    replies: list[ReplyResponse] | None = None,
    merged_questions: list[MergedQuestionItem] | None = None,
) -> QuestionPublic:
    sub_items = merged_questions or []
    has_manual = question.is_manual_merge or any(m.is_manual for m in sub_items)
    return QuestionPublic(
        id=question.id,
        room_id=question.room_id,
        content=question.content,
        author_display=_author_display(
            is_anonymous=question.is_anonymous, display_name=display_name
        ),
        is_anonymous=question.is_anonymous,
        status=question.status,
        upvote_count=question.upvote_count,
        downvote_count=question.downvote_count,
        score=question.score,
        highlighted=question.highlighted_at is not None,
        answered_at=question.answered_at,
        label_id=question.label_id,
        created_at=question.created_at,
        my_vote=my_vote,
        replies=replies or [],
        merged_into_id=question.merged_into_id,
        is_manual_merge=has_manual,
        merged_questions=sub_items,
    )


async def _merged_questions_by_parent(
    db: AsyncSession,
    parent_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[MergedQuestionItem]]:
    """批次載入被合併進主問題的原始問題清單（AI-002 保留原始題目供展開檢視）。"""
    if not parent_ids:
        return {}
    stmt = (
        select(Question, Participant.display_name)
        .outerjoin(Participant, Question.participant_id == Participant.id)
        .where(Question.merged_into_id.in_(parent_ids))
        .order_by(Question.created_at.asc())
    )
    result = await db.execute(stmt)
    grouped: dict[uuid.UUID, list[MergedQuestionItem]] = {pid: [] for pid in parent_ids}
    for q, name in result.all():
        if q.merged_into_id is not None:
            display = _author_display(is_anonymous=q.is_anonymous, display_name=name)
            grouped[q.merged_into_id].append(
                MergedQuestionItem(
                    id=q.id,
                    content=q.content,
                    author_display=display,
                    is_anonymous=q.is_anonymous,
                    upvote_count=q.upvote_count,
                    is_manual=q.is_manual_merge,
                    created_at=q.created_at,
                )
            )
    return grouped


def _to_reply(row: QuestionReply) -> ReplyResponse:
    return ReplyResponse(
        id=row.id,
        question_id=row.question_id,
        author_type=row.author_type,
        content=row.content,
        is_private=row.is_private,
        created_at=row.created_at,
    )


async def _replies_by_question(
    db: AsyncSession,
    question_ids: list[uuid.UUID],
    *,
    for_host: bool,
    viewer_participant_id: uuid.UUID | None = None,
    question_owners: dict[uuid.UUID, uuid.UUID | None] | None = None,
) -> dict[uuid.UUID, list[ReplyResponse]]:
    """批次載入回覆；參與者僅見公開回覆與自己的私密回覆。"""
    if not question_ids:
        return {}
    result = await db.execute(
        select(QuestionReply)
        .where(QuestionReply.question_id.in_(question_ids))
        .order_by(QuestionReply.created_at.asc())
    )
    owners = question_owners or {}
    grouped: dict[uuid.UUID, list[ReplyResponse]] = {qid: [] for qid in question_ids}
    for row in result.scalars().all():
        if for_host or not row.is_private:
            grouped[row.question_id].append(_to_reply(row))
            continue
        owner = owners.get(row.question_id)
        if (
            viewer_participant_id is not None
            and owner is not None
            and owner == viewer_participant_id
        ):
            grouped[row.question_id].append(_to_reply(row))
    return grouped


async def _get_question(db: AsyncSession, question_id: uuid.UUID) -> Question:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()
    if question is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到問題")
    return question


async def submit_question(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    claims: ParticipantTokenClaims,
    payload: QuestionCreateRequest,
) -> QuestionPublic:
    """提交問題（FE-004）。"""
    if claims.room_id != room_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權於此房間提問")

    limits = await rate_limit_service.limits_for_room(db, room_id)
    await qa_redis.check_question_rate_limit(
        claims.participant_id, limit=limits.question_per_min
    )

    qa = await interaction_service.get_qa_interaction(db, room_id)
    if qa is None or qa.status != InteractionStatus.ACTIVE:
        raise AppError(ErrorCode.QA_CLOSED, "Q&A 尚未開放或已關閉")

    settings = _qa_settings(qa.settings_jsonb)
    content = payload.content.strip()
    if not content:
        raise AppError(
            ErrorCode.VALIDATION_ERROR, "問題不可為空", details={"field": "content"}
        )
    if len(content) > settings.max_question_length:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"問題字數上限為 {settings.max_question_length} 字",
            details={"field": "content", "max": settings.max_question_length},
        )

    if payload.is_anonymous and not claims.anon_allowed:
        raise AppError(ErrorCode.ANON_NOT_ALLOWED, "此活動不允許匿名提問")

    status = (
        QuestionStatus.PENDING
        if settings.moderation_enabled
        else QuestionStatus.APPROVED
    )
    question = Question(
        id=uuid7(),
        session_id=claims.session_id,
        room_id=room_id,
        participant_id=claims.participant_id,
        content=content,
        status=status,
        is_anonymous=payload.is_anonymous,
        upvote_count=0,
        downvote_count=0,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)

    display_name = await _participant_display_name(db, claims.participant_id)
    public = _to_public(question, display_name=display_name)

    # 廣播：pending 僅送 host；approved 直入則全端（SDS §6.3）
    payload_obj = public.model_dump(mode="json")
    if status == QuestionStatus.PENDING:
        await events.publish(
            room_id,
            events.QUESTION_SUBMITTED,
            {"question": payload_obj},
            target_modes=events.MODE_HOST,
        )
    else:
        await events.publish(
            room_id,
            events.QUESTION_APPROVED,
            {"question": payload_obj},
            target_modes=events.MODE_ALL,
        )
    return public


async def _participant_display_name(
    db: AsyncSession, participant_id: uuid.UUID | None
) -> str | None:
    if participant_id is None:
        return None
    result = await db.execute(
        select(Participant.display_name).where(Participant.id == participant_id)
    )
    return result.scalar_one_or_none()


async def list_public_questions(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    sort: str,
    cursor: str | None,
    participant_id: uuid.UUID | None,
) -> QuestionListResponse:
    """公開問題列表（FE-005-FR1；僅 approved）。"""
    offset = _parse_cursor(cursor)
    stmt = (
        select(Question, Participant.display_name)
        .outerjoin(Participant, Question.participant_id == Participant.id)
        .where(
            Question.room_id == room_id,
            Question.status.in_(_PUBLIC_LIST_STATUSES),
            Question.merged_into_id.is_(None),
        )
    )
    if sort == "newest":
        stmt = stmt.order_by(Question.created_at.desc(), Question.id.desc())
    else:  # top
        stmt = stmt.order_by(
            Question.score.desc(), Question.created_at.desc(), Question.id.desc()
        )
    stmt = stmt.offset(offset).limit(_DEFAULT_PAGE_SIZE + 1)

    rows = (await db.execute(stmt)).all()
    has_more = len(rows) > _DEFAULT_PAGE_SIZE
    rows = rows[:_DEFAULT_PAGE_SIZE]

    my_votes = await _my_votes(
        db, [q.id for q, _ in rows], participant_id
    )
    owners = {q.id: q.participant_id for q, _ in rows}
    q_ids = [q.id for q, _ in rows]
    replies_map = await _replies_by_question(
        db,
        q_ids,
        for_host=False,
        viewer_participant_id=participant_id,
        question_owners=owners,
    )
    merged_map = await _merged_questions_by_parent(db, q_ids)
    items: list[QuestionPublic] = []
    for q, name in rows:
        up, down, score = await qa_redis.get_effective_counts(db, q)
        pub = _to_public(
            q,
            display_name=name,
            my_vote=my_votes.get(q.id),
            replies=replies_map.get(q.id, []),
            merged_questions=merged_map.get(q.id, []),
        )
        items.append(
            pub.model_copy(
                update={"upvote_count": up, "downvote_count": down, "score": score}
            )
        )
    next_cursor = str(offset + _DEFAULT_PAGE_SIZE) if has_more else None
    qa = await interaction_service.get_qa_interaction(db, room_id)
    settings = _qa_settings(qa.settings_jsonb if qa else None)
    return QuestionListResponse(
        items=items,
        next_cursor=next_cursor,
        downvote_enabled=settings.downvote_enabled,
    )


def _parse_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        value = int(cursor)
    except ValueError:
        return 0
    return max(value, 0)


async def _my_votes(
    db: AsyncSession,
    question_ids: list[uuid.UUID],
    participant_id: uuid.UUID | None,
) -> dict[uuid.UUID, VoteDirection]:
    if participant_id is None or not question_ids:
        return {}
    result = await db.execute(
        select(QuestionVote.question_id, QuestionVote.direction).where(
            QuestionVote.question_id.in_(question_ids),
            QuestionVote.participant_id == participant_id,
        )
    )
    return {
        qid: (VoteDirection.UP if direction > 0 else VoteDirection.DOWN)
        for qid, direction in result.all()
    }


async def vote_question(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    claims: ParticipantTokenClaims,
    direction: VoteDirection,
) -> VoteResult:
    """upvote／downvote（toggle 語意；FE-005-FR2/FR3）。"""
    question = await _get_question(db, question_id)
    limits = await rate_limit_service.limits_for_room(db, question.room_id)
    await qa_redis.check_upvote_rate_limit(
        claims.participant_id, limit=limits.upvote_per_min
    )
    if claims.room_id != question.room_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權於此房間投票")
    # FE-005-AC5：僅能對 approved（含 answered）問題互動
    if question.status not in _VOTABLE_STATUSES:
        raise AppError(ErrorCode.FORBIDDEN, "僅能對已公開的問題投票")

    qa = await interaction_service.get_qa_interaction(db, question.room_id)
    settings = _qa_settings(qa.settings_jsonb if qa else None)
    if direction == VoteDirection.DOWN and not settings.downvote_enabled:
        raise AppError(ErrorCode.FORBIDDEN, "此 Q&A 未啟用 downvote")

    want = 1 if direction == VoteDirection.UP else -1
    existing = (
        await db.execute(
            select(QuestionVote).where(
                QuestionVote.question_id == question_id,
                QuestionVote.participant_id == claims.participant_id,
            )
        )
    ).scalar_one_or_none()

    delta_up = 0
    delta_down = 0
    my_vote: VoteDirection | None
    if existing is None:
        db.add(
            QuestionVote(
                id=uuid7(),
                question_id=question_id,
                participant_id=claims.participant_id,
                direction=want,
                created_at=dt.datetime.now(dt.UTC),
            )
        )
        if want == 1:
            delta_up = 1
        else:
            delta_down = 1
        my_vote = direction
    elif existing.direction == want:
        # 再次點擊同方向 → 取消
        await db.delete(existing)
        if want == 1:
            delta_up = -1
        else:
            delta_down = -1
        my_vote = None
    else:
        # 改投相反方向
        existing.direction = want
        if want == 1:
            delta_up, delta_down = 1, -1
        else:
            delta_up, delta_down = -1, 1
        my_vote = direction

    await apply_vote_counts_to_db(
        db, question_id, delta_up=delta_up, delta_down=delta_down
    )
    await db.commit()
    await db.refresh(question)

    up, down, score = await qa_redis.get_effective_counts(db, question)

    result = VoteResult(
        question_id=question.id,
        upvote_count=up,
        downvote_count=down,
        score=score,
        my_vote=my_vote,
    )
    event_type = (
        events.QUESTION_UPVOTED
        if direction == VoteDirection.UP
        else events.QUESTION_DOWNVOTED
    )
    await qa_redis.publish_vote_event_throttled(
        question.room_id,
        question.id,
        event_type,
        {
            "question_id": str(question.id),
            "upvote_count": up,
            "downvote_count": down,
            "score": score,
        },
    )
    return result


async def apply_vote_counts_to_db(
    db: AsyncSession,
    question_id: uuid.UUID,
    *,
    delta_up: int,
    delta_down: int,
) -> None:
    """委派 qa_redis：有 Redis 時延遲 flush，否則直接 UPDATE。"""
    await qa_redis.apply_vote_counts_to_db(
        db, question_id, delta_up=delta_up, delta_down=delta_down
    )


async def list_moderation(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    status: QuestionStatus | None,
) -> list[QuestionPublic]:
    """審核清單（BE-004-FR2）。"""
    await interaction_service.ensure_room_access(db, room_id, host)
    stmt = (
        select(Question, Participant.display_name)
        .outerjoin(Participant, Question.participant_id == Participant.id)
        .where(
            Question.room_id == room_id,
            Question.merged_into_id.is_(None),
        )
    )
    if status is not None:
        stmt = stmt.where(Question.status == status)
    stmt = stmt.order_by(Question.created_at.desc())
    rows = (await db.execute(stmt)).all()
    qids = [q.id for q, _ in rows]
    replies_map = await _replies_by_question(db, qids, for_host=True)
    merged_map = await _merged_questions_by_parent(db, qids)
    return [
        _to_public(
            q,
            display_name=name,
            replies=replies_map.get(q.id, []),
            merged_questions=merged_map.get(q.id, []),
        )
        for q, name in rows
    ]


async def _load_question_for_host(
    db: AsyncSession, question_id: uuid.UUID, host: User
) -> Question:
    question = await _get_question(db, question_id)
    # 透過房間驗證 host 權限
    await interaction_service.ensure_room_access(db, question.room_id, host)
    return question


_TRANSITIONS: dict[ModerateAction, tuple[set[QuestionStatus], QuestionStatus]] = {
    ModerateAction.APPROVE: ({QuestionStatus.PENDING}, QuestionStatus.APPROVED),
    ModerateAction.DISMISS: (
        {QuestionStatus.PENDING, QuestionStatus.APPROVED},
        QuestionStatus.DISMISSED,
    ),
    ModerateAction.ARCHIVE: (
        {QuestionStatus.APPROVED, QuestionStatus.ANSWERED},
        QuestionStatus.ARCHIVED,
    ),
    ModerateAction.RESTORE: ({QuestionStatus.DISMISSED}, QuestionStatus.PENDING),
    ModerateAction.UNAPPROVE: ({QuestionStatus.APPROVED}, QuestionStatus.PENDING),
    ModerateAction.ANSWER: ({QuestionStatus.APPROVED}, QuestionStatus.ANSWERED),
    ModerateAction.UNANSWER: ({QuestionStatus.ANSWERED}, QuestionStatus.APPROVED),
}


async def moderate_question(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    host: User,
    action: ModerateAction,
) -> QuestionPublic:
    """審核／現場動作（BE-004-FR2/FR3）。"""
    question = await _load_question_for_host(db, question_id, host)

    if action in (ModerateAction.HIGHLIGHT, ModerateAction.UNHIGHLIGHT):
        await _apply_highlight(db, question, action)
    else:
        await _apply_transition(question, action)

    await audit_service.log(
        db,
        actor=host,
        action=f"question.{action.value}",
        target_type="question",
        target_id=question.id,
        session_id=question.session_id,
        room_id=question.room_id,
        details={"new_status": question.status.value},
    )

    await db.commit()
    await db.refresh(question)

    display_name = await _participant_display_name(db, question.participant_id)
    public = _to_public(question, display_name=display_name)
    await _broadcast_moderation(action, public)
    return public


async def _apply_transition(question: Question, action: ModerateAction) -> None:
    allowed, target = _TRANSITIONS[action]
    if question.status not in allowed:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"無法從 {question.status.value} 執行 {action.value}",
            http_status=409,
        )
    question.status = target
    if action == ModerateAction.ANSWER:
        question.answered_at = dt.datetime.now(dt.UTC)
    elif action == ModerateAction.UNANSWER:
        question.answered_at = None


async def _apply_highlight(
    db: AsyncSession, question: Question, action: ModerateAction
) -> None:
    if action == ModerateAction.UNHIGHLIGHT:
        question.highlighted_at = None
        return
    # 同房間僅一題可高亮（BE-004-FR3）：先清除其他高亮
    await db.execute(
        update(Question)
        .where(
            Question.room_id == question.room_id,
            Question.id != question.id,
            Question.highlighted_at.is_not(None),
        )
        .values(highlighted_at=None)
    )
    question.highlighted_at = dt.datetime.now(dt.UTC)


async def _broadcast_moderation(action: ModerateAction, public: QuestionPublic) -> None:
    payload_obj = public.model_dump(mode="json")
    if action == ModerateAction.APPROVE:
        await events.publish(
            public.room_id,
            events.QUESTION_APPROVED,
            {"question": payload_obj},
            target_modes=events.MODE_ALL,
        )
    elif action == ModerateAction.UNAPPROVE:
        await events.publish(
            public.room_id,
            events.QUESTION_DISMISSED,
            {"question_id": str(public.id)},
            target_modes=events.MODE_ALL,
        )
    elif action in (ModerateAction.DISMISS, ModerateAction.ARCHIVE):
        await events.publish(
            public.room_id,
            events.QUESTION_DISMISSED,
            {"question_id": str(public.id)},
            target_modes=events.MODE_HOST,
        )
    elif action == ModerateAction.ANSWER:
        await events.publish(
            public.room_id,
            events.QUESTION_ANSWERED,
            {
                "question_id": str(public.id),
                "answered_at": public.answered_at.isoformat()
                if public.answered_at
                else None,
            },
            target_modes=events.MODE_ALL,
        )
    elif action in (ModerateAction.HIGHLIGHT, ModerateAction.UNHIGHLIGHT):
        await events.publish(
            public.room_id,
            events.QUESTION_HIGHLIGHTED,
            {
                "question_id": str(public.id)
                if action == ModerateAction.HIGHLIGHT
                else None
            },
            target_modes=events.MODE_ALL,
        )


async def reply_question(
    db: AsyncSession,
    *,
    question_id: uuid.UUID,
    host: User,
    payload: ReplyCreateRequest,
) -> ReplyResponse:
    """Host 回覆問題（BE-004-FR3）。"""
    question = await _load_question_for_host(db, question_id, host)
    reply = QuestionReply(
        id=uuid7(),
        question_id=question.id,
        author_type=ReplyAuthorType.HOST,
        author_id=host.id,
        content=payload.content,
        is_private=payload.is_private,
        created_at=dt.datetime.now(dt.UTC),
    )
    db.add(reply)
    await audit_service.log(
        db,
        actor=host,
        action="question.reply",
        target_type="question",
        target_id=question.id,
        session_id=question.session_id,
        room_id=question.room_id,
        details={"reply_id": str(reply.id), "is_private": reply.is_private},
    )
    await db.commit()
    await db.refresh(reply)

    reply_resp = _to_reply(reply)
    payload = reply_resp.model_dump(mode="json")
    if not reply.is_private:
        await events.publish(
            question.room_id,
            events.QUESTION_REPLIED,
            {"question_id": str(question.id), "reply": payload},
            target_modes=events.MODE_ALL,
        )
    else:
        await events.publish(
            question.room_id,
            events.QUESTION_REPLIED,
            {"question_id": str(question.id), "reply": payload},
            target_modes=events.MODE_HOST,
        )

    return reply_resp


async def dedup_room_questions(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    ai_override: AiConfigOverride | None = None,
) -> AiDedupQuestionsResponse:
    """以 AI 掃描房間內進行中與待審提問，進行語意去重與同義推薦（AI-002）。"""
    await interaction_service.ensure_room_access(db, room_id, host)

    # 撈取非 archived 且非 dismissed 的提問（例如 approved, pending, answered）
    stmt = (
        select(Question, Participant.display_name)
        .outerjoin(Participant, Question.participant_id == Participant.id)
        .where(
            Question.room_id == room_id,
            Question.status.in_([QuestionStatus.APPROVED, QuestionStatus.PENDING, QuestionStatus.ANSWERED]),
        )
        .order_by(Question.created_at.desc())
    )
    rows = (await db.execute(stmt)).all()

    questions_payload = []
    for q, name in rows:
        author = _author_display(is_anonymous=q.is_anonymous, display_name=name)
        questions_payload.append({
            "id": str(q.id),
            "content": q.content,
            "author_display": author,
            "is_anonymous": q.is_anonymous,
            "upvote_count": q.upvote_count,
            "status": q.status.value,
            "created_at": q.created_at.isoformat() if q.created_at else None,
        })

    return await ai_service.dedup_questions(
        db, user=host, questions=questions_payload, ai_override=ai_override
    )


async def merge_duplicate_questions(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    payload: MergeQuestionsRequest,
) -> MergeQuestionsResponse:
    """將同義/重複提問合併至主提問（AI-002）。

    - 聚合重複題目的讚數至主提問（累計加總）。
    - 重複題狀態改為 dismissed，並新增一則主持人說明回覆。
    - 即時透過 WebSocket 廣播主提問票數更新與重複題關閉事件。
    - 寫入審計日誌。
    """
    await interaction_service.ensure_room_access(db, room_id, host)

    # 1. 主提問
    primary_q = await _get_question(db, payload.primary_question_id)
    if primary_q.room_id != room_id:
        raise AppError(ErrorCode.FORBIDDEN, "主提問不屬於此房間")

    # 2. 重複提問
    dup_stmt = select(Question).where(
        Question.id.in_(payload.duplicate_question_ids),
        Question.room_id == room_id,
        Question.id != payload.primary_question_id,
    )
    dup_rows = (await db.execute(dup_stmt)).scalars().all()
    if not dup_rows:
        raise AppError(ErrorCode.VALIDATION_ERROR, "未找到有效的重複題目可供合併")

    total_upvotes_to_add = 0
    merged_ids: list[uuid.UUID] = []

    for dq in dup_rows:
        total_upvotes_to_add += dq.upvote_count
        merged_ids.append(dq.id)
        dq.status = QuestionStatus.DISMISSED
        dq.merged_into_id = primary_q.id
        dq.is_manual_merge = payload.is_manual

        # 加入主持人系統回覆
        prefix = "【手動拖曳合併】" if payload.is_manual else "【AI 語意合併】"
        reply_id = uuid7()
        reply_obj = QuestionReply(
            id=reply_id,
            question_id=dq.id,
            author_type=ReplyAuthorType.HOST,
            content=f"{prefix}此問題已由主持人合併至主提問：「{primary_q.content}」，原獲得之 {dq.upvote_count} 票已全數累計至主提問！",
            is_private=False,
            created_at=dt.datetime.now(dt.UTC),
        )
        db.add(reply_obj)

    if payload.is_manual:
        primary_q.is_manual_merge = True

    # 3. 累計票數至主提問
    primary_q.upvote_count += total_upvotes_to_add
    await db.commit()
    await db.refresh(primary_q)

    # 4. WebSocket 廣播
    merged_map = await _merged_questions_by_parent(db, [primary_q.id])
    primary_display = await _participant_display_name(db, primary_q.participant_id)
    primary_public = _to_public(
        primary_q,
        display_name=primary_display,
        merged_questions=merged_map.get(primary_q.id, []),
    )
    await events.publish(
        room_id,
        events.QUESTION_APPROVED,
        {"question": primary_public.model_dump(mode="json")},
        target_modes=events.MODE_ALL,
    )

    for mid in merged_ids:
        await events.publish(
            room_id,
            events.QUESTION_DISMISSED,
            {"question_id": str(mid)},
            target_modes=events.MODE_ALL,
        )

    # 5. 紀錄審計日誌
    await audit_service.log(
        db,
        room_id=room_id,
        user=host,
        action="question.merge",
        target_id=primary_q.id,
        payload={
            "merged_question_ids": [str(mid) for mid in merged_ids],
            "total_upvotes_added": total_upvotes_to_add,
            "is_manual": payload.is_manual,
        },
    )

    msg_action = "手動合併" if payload.is_manual else "AI 語意合併"
    return MergeQuestionsResponse(
        primary_question_id=primary_q.id,
        merged_question_ids=merged_ids,
        new_upvote_count=primary_q.upvote_count,
        new_score=primary_q.score,
        total_upvotes_added=total_upvotes_to_add,
        is_manual=payload.is_manual,
        message=f"已成功{msg_action} {len(merged_ids)} 則提問，累計增加 {total_upvotes_to_add} 票！",
    )


async def unmerge_question(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User,
    question_id: uuid.UUID,
) -> UnmergeQuestionResponse:
    """主持人將先前被合併的特定題目解除合併（還原為獨立提問，AI-002）。"""
    await interaction_service.ensure_room_access(db, room_id, host)
    q = await _get_question(db, question_id)
    if q.room_id != room_id:
        raise AppError(ErrorCode.FORBIDDEN, "問題不屬於此房間")
    if q.merged_into_id is None:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此問題未被合併，無需解除")

    primary_id = q.merged_into_id
    primary_q = await _get_question(db, primary_id)

    # 扣除原累計至主提問的票數
    primary_q.upvote_count = max(0, primary_q.upvote_count - q.upvote_count)

    # 還原被解除之子問題
    q.merged_into_id = None
    q.is_manual_merge = False
    q.status = QuestionStatus.APPROVED

    # 新增系統紀錄回覆
    reply_id = uuid7()
    reply_obj = QuestionReply(
        id=reply_id,
        question_id=q.id,
        author_type=ReplyAuthorType.HOST,
        content=f"【解除合併】此問題已由主持人從主提問「{primary_q.content}」解除合併，還原為獨立提問。",
        is_private=False,
        created_at=dt.datetime.now(dt.UTC),
    )
    db.add(reply_obj)

    await db.commit()
    await db.refresh(primary_q)
    await db.refresh(q)

    # 檢查主問題是否仍包含其他手動合併題
    remaining_merged = await _merged_questions_by_parent(db, [primary_q.id])
    sub_list = remaining_merged.get(primary_q.id, [])
    if not any(m.is_manual for m in sub_list):
        primary_q.is_manual_merge = False
        await db.commit()
        await db.refresh(primary_q)

    # 廣播主問題更新（扣除票數與子題目清單減少）
    p_display = await _participant_display_name(db, primary_q.participant_id)
    p_public = _to_public(primary_q, display_name=p_display, merged_questions=sub_list)
    await events.publish(
        room_id,
        events.QUESTION_APPROVED,
        {"question": p_public.model_dump(mode="json")},
        target_modes=events.MODE_ALL,
    )

    # 廣播已還原的子問題（重新出現在 approved 列表）
    q_display = await _participant_display_name(db, q.participant_id)
    q_public = _to_public(q, display_name=q_display, merged_questions=[])
    await events.publish(
        room_id,
        events.QUESTION_APPROVED,
        {"question": q_public.model_dump(mode="json")},
        target_modes=events.MODE_ALL,
    )

    await audit_service.log(
        db,
        room_id=room_id,
        user=host,
        action="question.unmerge",
        target_id=q.id,
        payload={
            "unmerged_question_id": str(q.id),
            "primary_question_id": str(primary_q.id),
            "deducted_upvotes": q.upvote_count,
        },
    )

    return UnmergeQuestionResponse(
        unmerged_question_id=q.id,
        primary_question_id=primary_q.id,
        primary_new_upvote_count=primary_q.upvote_count,
        message=f"已成功解除合併「{q.content}」，還原為獨立提問！",
    )
