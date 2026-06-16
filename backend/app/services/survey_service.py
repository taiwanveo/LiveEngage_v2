"""Survey 業務邏輯（BE-006、FE-012 MVP）。"""

from __future__ import annotations

import datetime as dt
import uuid
from collections import Counter
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.tokens import ScreenTokenClaims
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollOption, PollResponse
from app.models.sprint9 import SurveyQuestion, SurveySubmission
from app.models.user import User
from app.schemas.poll import PollOptionPublic
from app.schemas.survey import (
    SurveyAnswerCount,
    SurveyQuestionCreateRequest,
    SurveyQuestionParticipantPublic,
    SurveyQuestionPublic,
    SurveyResultsResponse,
    SurveySubmissionAnswerDetail,
    SurveySubmissionDetail,
    SurveySubmissionsResponse,
    SurveySubmitRequest,
    SurveySubmitResult,
)
from app.services import audit_service, interaction_service, screen_service


_SURVEY_CHILD_TYPES = frozenset(
    {
        InteractionType.MULTIPLE_CHOICE,
        InteractionType.OPEN_TEXT,
        InteractionType.RATING,
    }
)


async def _load_survey_for_host(
    db: AsyncSession, survey_interaction_id: uuid.UUID, host: User
) -> Interaction:
    result = await db.execute(
        select(Interaction).where(Interaction.id == survey_interaction_id)
    )
    survey = result.scalar_one_or_none()
    if survey is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    await interaction_service.ensure_room_access(db, survey.room_id, host)
    if survey.type != InteractionType.SURVEY:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此互動項目不是 Survey")
    return survey


async def _load_survey_for_screen(
    db: AsyncSession, survey_interaction_id: uuid.UUID, screen: ScreenTokenClaims
) -> Interaction:
    result = await db.execute(
        select(Interaction).where(Interaction.id == survey_interaction_id)
    )
    survey = result.scalar_one_or_none()
    if survey is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到互動項目")
    if survey.type != InteractionType.SURVEY:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此互動項目不是 Survey")
    if survey.room_id != screen.room_id:
        raise AppError(ErrorCode.FORBIDDEN, "無權讀取此 Survey")
    await screen_service.validate_screen_token_epoch(
        screen.room_id, screen.token_epoch
    )
    return survey


async def add_question(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    host: User,
    payload: SurveyQuestionCreateRequest,
) -> SurveyQuestionPublic:
    """新增 Survey 子題（child interaction + SurveyQuestion）。"""
    survey = await _load_survey_for_host(db, survey_interaction_id, host)
    if payload.question_type not in _SURVEY_CHILD_TYPES:
        raise AppError(
            ErrorCode.VALIDATION_ERROR,
            f"Survey 子題不支援題型 {payload.question_type}",
        )

    if payload.question_type == InteractionType.MULTIPLE_CHOICE:
        if len(payload.options) < 2:
            raise AppError(
                ErrorCode.VALIDATION_ERROR, "選擇題至少需要 2 個選項"
            )
        if any(not opt.text.strip() for opt in payload.options):
            raise AppError(ErrorCode.VALIDATION_ERROR, "選項文字不可為空")

    max_order = await db.execute(
        select(func.coalesce(func.max(SurveyQuestion.order_no), -1)).where(
            SurveyQuestion.survey_interaction_id == survey_interaction_id
        )
    )
    next_order = int(max_order.scalar_one()) + 1
    now = dt.datetime.now(dt.UTC)

    child = Interaction(
        id=uuid7(),
        room_id=survey.room_id,
        type=payload.question_type,
        title=payload.title,
        description=payload.description,
        status=InteractionStatus.IDLE,
        order_no=next_order,
        settings_jsonb={"required": payload.required},
        created_by=host.id,
    )
    db.add(child)
    await db.flush()

    if payload.question_type in (
        InteractionType.MULTIPLE_CHOICE,
        InteractionType.RANKING,
    ):
        for i, opt in enumerate(payload.options):
            db.add(
                PollOption(
                    id=uuid7(),
                    interaction_id=child.id,
                    text=opt.text,
                    is_correct=False,
                    order_no=opt.order_no if opt.order_no else i,
                    created_at=now,
                )
            )

    sq = SurveyQuestion(
        id=uuid7(),
        survey_interaction_id=survey_interaction_id,
        child_interaction_id=child.id,
        required=payload.required,
        page_no=payload.page_no,
        order_no=next_order,
        created_at=now,
    )
    db.add(sq)
    await audit_service.log(
        db,
        actor=host,
        action="survey.add_question",
        target_type="survey_question",
        target_id=sq.id,
        room_id=survey.room_id,
    )
    await db.commit()
    await db.refresh(sq)

    return await _to_question_public(db, sq, child)


async def list_questions(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    host: User,
) -> list[SurveyQuestionPublic]:
    """列出 Survey 全部子題（Host）。"""
    await _load_survey_for_host(db, survey_interaction_id, host)
    rows = await db.execute(
        select(SurveyQuestion, Interaction)
        .join(Interaction, SurveyQuestion.child_interaction_id == Interaction.id)
        .where(SurveyQuestion.survey_interaction_id == survey_interaction_id)
        .order_by(SurveyQuestion.page_no, SurveyQuestion.order_no)
    )
    items: list[SurveyQuestionPublic] = []
    for sq, child in rows.all():
        items.append(await _to_question_public(db, sq, child))
    return items


async def _question_options_public(
    db: AsyncSession, child_interaction_id: uuid.UUID
) -> list[PollOptionPublic]:
    result = await db.execute(
        select(PollOption)
        .where(PollOption.interaction_id == child_interaction_id)
        .order_by(PollOption.order_no)
    )
    return [
        PollOptionPublic(id=o.id, text=o.text, order_no=o.order_no)
        for o in result.scalars().all()
    ]


async def list_questions_for_participant(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    participant_id: uuid.UUID,
) -> list[SurveyQuestionParticipantPublic]:
    """列出 Survey 子題（參與者作答）。"""
    result = await db.execute(
        select(Interaction).where(Interaction.id == survey_interaction_id)
    )
    survey = result.scalar_one_or_none()
    if survey is None or survey.type != InteractionType.SURVEY:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 Survey")
    if survey.status != InteractionStatus.ACTIVE:
        return []

    part_check = await db.execute(
        select(Participant.id).where(
            Participant.id == participant_id,
            Participant.room_id == survey.room_id,
        )
    )
    if part_check.scalar_one_or_none() is None:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此房間")

    rows = await db.execute(
        select(SurveyQuestion, Interaction)
        .join(Interaction, SurveyQuestion.child_interaction_id == Interaction.id)
        .where(SurveyQuestion.survey_interaction_id == survey_interaction_id)
        .order_by(SurveyQuestion.page_no, SurveyQuestion.order_no)
    )
    items: list[SurveyQuestionParticipantPublic] = []
    for sq, child in rows.all():
        options: list[PollOptionPublic] = []
        if child.type in (
            InteractionType.MULTIPLE_CHOICE,
            InteractionType.RANKING,
        ):
            options = await _question_options_public(db, child.id)
        items.append(
            SurveyQuestionParticipantPublic(
                child_interaction_id=child.id,
                title=child.title,
                question_type=child.type,
                required=sq.required,
                page_no=sq.page_no,
                order_no=sq.order_no,
                options=options,
            )
        )
    return items


def _build_question_public(
    sq: SurveyQuestion,
    child: Interaction,
    *,
    options: list[PollOptionPublic] | None = None,
) -> SurveyQuestionPublic:
    return SurveyQuestionPublic(
        id=sq.id,
        survey_interaction_id=sq.survey_interaction_id,
        child_interaction_id=child.id,
        title=child.title,
        question_type=child.type,
        required=sq.required,
        page_no=sq.page_no,
        order_no=sq.order_no,
        options=options or [],
    )


async def _to_question_public(
    db: AsyncSession, sq: SurveyQuestion, child: Interaction
) -> SurveyQuestionPublic:
    options: list[PollOptionPublic] = []
    if child.type == InteractionType.MULTIPLE_CHOICE:
        options = await _question_options_public(db, child.id)
    return _build_question_public(sq, child, options=options)


async def submit_survey(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    participant_id: uuid.UUID,
    payload: SurveySubmitRequest,
) -> SurveySubmitResult:
    """提交 Survey 答案（answers_jsonb 以 child interaction id 為 key）。"""
    result = await db.execute(
        select(Interaction).where(Interaction.id == survey_interaction_id)
    )
    survey = result.scalar_one_or_none()
    if survey is None or survey.type != InteractionType.SURVEY:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 Survey")

    part_check = await db.execute(
        select(Participant.id).where(
            Participant.id == participant_id,
            Participant.room_id == survey.room_id,
        )
    )
    if part_check.scalar_one_or_none() is None:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此房間")

    questions = await db.execute(
        select(SurveyQuestion).where(
            SurveyQuestion.survey_interaction_id == survey_interaction_id
        )
    )
    child_map = {str(q.child_interaction_id): q for q in questions.scalars().all()}

    for key, answer in payload.answers.items():
        if key not in child_map:
            raise AppError(
                ErrorCode.VALIDATION_ERROR, f"未知的子題 id：{key}"
            )
        sq = child_map[key]
        if sq.required and not answer:
            raise AppError(ErrorCode.VALIDATION_ERROR, f"子題 {key} 為必填")

    now = dt.datetime.now(dt.UTC)
    existing = await db.execute(
        select(SurveySubmission).where(
            SurveySubmission.survey_interaction_id == survey_interaction_id,
            SurveySubmission.participant_id == participant_id,
        )
    )
    submission = existing.scalar_one_or_none()
    answers_jsonb: dict[str, Any] = dict(payload.answers)

    if submission is None:
        submission = SurveySubmission(
            id=uuid7(),
            survey_interaction_id=survey_interaction_id,
            participant_id=participant_id,
            answers_jsonb=answers_jsonb,
            completed=payload.completed,
            submitted_at=now if payload.completed else None,
            created_at=now,
        )
        db.add(submission)
    else:
        submission.answers_jsonb = answers_jsonb
        submission.completed = payload.completed
        submission.submitted_at = now if payload.completed else submission.submitted_at

    for key, answer in payload.answers.items():
        child_id = uuid.UUID(key)
        child_result = await db.execute(
            select(Interaction).where(Interaction.id == child_id)
        )
        child = child_result.scalar_one_or_none()
        if child is None:
            continue
        if child.type == InteractionType.MULTIPLE_CHOICE and isinstance(answer, dict):
            option_ids = answer.get("option_ids", [])
            if option_ids:
                pr_existing = (
                    await db.execute(
                        select(PollResponse).where(
                            PollResponse.interaction_id == child_id,
                            PollResponse.participant_id == participant_id,
                            PollResponse.submission_no == 0,
                        )
                    )
                ).scalar_one_or_none()
                answer_data = {"option_ids": option_ids}
                if pr_existing is None:
                    db.add(
                        PollResponse(
                            id=uuid7(),
                            interaction_id=child_id,
                            participant_id=participant_id,
                            answer_jsonb=answer_data,
                            submission_no=0,
                            submitted_at=now,
                        )
                    )
                else:
                    pr_existing.answer_jsonb = answer_data
                    pr_existing.submitted_at = now

    await db.commit()
    return SurveySubmitResult(
        survey_interaction_id=survey_interaction_id,
        participant_id=participant_id,
        completed=payload.completed,
    )


async def get_results(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    host: User | None = None,
    screen: ScreenTokenClaims | None = None,
) -> SurveyResultsResponse:
    """Survey 結果聚合（各子題作答數）。"""
    if host is not None:
        await _load_survey_for_host(db, survey_interaction_id, host)
    elif screen is not None:
        await _load_survey_for_screen(db, survey_interaction_id, screen)
    else:
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少授權")

    submission_count = await db.execute(
        select(func.count())
        .select_from(SurveySubmission)
        .where(
            SurveySubmission.survey_interaction_id == survey_interaction_id,
            SurveySubmission.completed.is_(True),
        )
    )
    total_submissions = int(submission_count.scalar_one())

    sq_rows = await db.execute(
        select(SurveyQuestion).where(
            SurveyQuestion.survey_interaction_id == survey_interaction_id
        )
        .order_by(SurveyQuestion.page_no, SurveyQuestion.order_no)
    )
    questions: list[SurveyAnswerCount] = []

    completed_submissions = (
        await db.execute(
            select(SurveySubmission.answers_jsonb).where(
                SurveySubmission.survey_interaction_id == survey_interaction_id,
                SurveySubmission.completed.is_(True),
            )
        )
    ).all()

    for sq in sq_rows.scalars().all():
        child = await db.execute(
            select(Interaction).where(Interaction.id == sq.child_interaction_id)
        )
        child_i = child.scalar_one_or_none()
        option_counts: dict[str, int] | None = None
        rating_counts: dict[str, int] | None = None
        count = 0

        if child_i and child_i.type == InteractionType.RATING:
            rating_counter: Counter[str] = Counter()
            child_key = str(sq.child_interaction_id)
            for (answers,) in completed_submissions:
                if not isinstance(answers, dict):
                    continue
                ans = answers.get(child_key)
                if isinstance(ans, dict) and "value" in ans:
                    rating_counter[str(ans["value"])] += 1
                elif isinstance(ans, (int, float)):
                    rating_counter[str(int(ans))] += 1
            rating_counts = dict(rating_counter) if rating_counter else None
            count = sum(rating_counter.values())
        elif child_i and child_i.type == InteractionType.OPEN_TEXT:
            child_key = str(sq.child_interaction_id)
            text_counter = 0
            for (answers,) in completed_submissions:
                if not isinstance(answers, dict):
                    continue
                ans = answers.get(child_key)
                if isinstance(ans, str) and ans.strip():
                    text_counter += 1
            count = text_counter
        else:
            resp_count = await db.execute(
                select(func.count())
                .select_from(PollResponse)
                .where(PollResponse.interaction_id == sq.child_interaction_id)
            )
            count = int(resp_count.scalar_one())
            if child_i and child_i.type == InteractionType.MULTIPLE_CHOICE:
                responses = await db.execute(
                    select(PollResponse.answer_jsonb).where(
                        PollResponse.interaction_id == sq.child_interaction_id
                    )
                )
                counter: Counter[str] = Counter()
                for (ans,) in responses.all():
                    for oid in ans.get("option_ids", []):
                        counter[str(oid)] += 1
                option_counts = dict(counter)

        questions.append(
            SurveyAnswerCount(
                child_interaction_id=sq.child_interaction_id,
                title=child_i.title if child_i else None,
                question_type=child_i.type.value if child_i else None,
                response_count=count,
                option_counts=option_counts,
                rating_counts=rating_counts,
            )
        )

    return SurveyResultsResponse(
        survey_interaction_id=survey_interaction_id,
        submission_count=total_submissions,
        questions=questions,
    )


def _format_survey_answer_text(
    child_type: InteractionType,
    raw: Any,
    option_text_by_id: dict[str, str],
) -> str:
    """將 answers_jsonb 單題原始值轉為主持人可讀文字。"""
    if raw is None or raw == "":
        return "（未作答）"
    if child_type == InteractionType.OPEN_TEXT:
        if isinstance(raw, str):
            return raw.strip() or "（未作答）"
        return str(raw)
    if child_type == InteractionType.RATING:
        if isinstance(raw, dict) and "value" in raw:
            return str(raw["value"])
        if isinstance(raw, (int, float)):
            return str(int(raw))
        return str(raw)
    if child_type == InteractionType.MULTIPLE_CHOICE:
        if isinstance(raw, dict):
            option_ids = raw.get("option_ids", [])
            if not option_ids:
                return "（未作答）"
            texts = [
                option_text_by_id.get(str(oid), str(oid)) for oid in option_ids
            ]
            return "、".join(texts)
        return str(raw)
    return str(raw)


async def list_submissions_for_host(
    db: AsyncSession,
    *,
    survey_interaction_id: uuid.UUID,
    host: User,
) -> SurveySubmissionsResponse:
    """列出 Survey 逐人完整作答（Host 工作台）。"""
    await _load_survey_for_host(db, survey_interaction_id, host)

    sq_rows = (
        await db.execute(
            select(SurveyQuestion)
            .where(SurveyQuestion.survey_interaction_id == survey_interaction_id)
            .order_by(SurveyQuestion.page_no, SurveyQuestion.order_no)
        )
    ).scalars().all()

    question_context: list[tuple[SurveyQuestion, Interaction]] = []
    option_text_by_id: dict[str, str] = {}

    for sq in sq_rows:
        child = (
            await db.execute(
                select(Interaction).where(Interaction.id == sq.child_interaction_id)
            )
        ).scalar_one_or_none()
        if child is None:
            continue
        if child.type == InteractionType.MULTIPLE_CHOICE:
            for opt in await _question_options_public(db, child.id):
                option_text_by_id[str(opt.id)] = opt.text
        question_context.append((sq, child))

    rows = (
        await db.execute(
            select(SurveySubmission, Participant)
            .join(Participant, Participant.id == SurveySubmission.participant_id)
            .where(
                SurveySubmission.survey_interaction_id == survey_interaction_id,
                SurveySubmission.completed.is_(True),
            )
            .order_by(
                SurveySubmission.submitted_at.desc().nulls_last(),
                SurveySubmission.created_at.desc(),
            )
        )
    ).all()

    submissions: list[SurveySubmissionDetail] = []
    for submission, participant in rows:
        answers_jsonb = submission.answers_jsonb
        if not isinstance(answers_jsonb, dict):
            answers_jsonb = {}

        answer_details: list[SurveySubmissionAnswerDetail] = []
        for _sq, child in question_context:
            child_key = str(child.id)
            raw = answers_jsonb.get(child_key)
            answer_details.append(
                SurveySubmissionAnswerDetail(
                    child_interaction_id=child.id,
                    question_title=child.title,
                    question_type=child.type.value,
                    answer_text=_format_survey_answer_text(
                        child.type, raw, option_text_by_id
                    ),
                )
            )

        submissions.append(
            SurveySubmissionDetail(
                submission_id=submission.id,
                participant_id=submission.participant_id,
                display_name=participant.display_name,
                submitted_at=submission.submitted_at,
                answers=answer_details,
            )
        )

    return SurveySubmissionsResponse(
        survey_interaction_id=survey_interaction_id,
        submissions=submissions,
    )
