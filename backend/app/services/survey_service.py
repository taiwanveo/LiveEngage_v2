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
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollOption, PollResponse
from app.models.sprint9 import SurveyQuestion, SurveySubmission
from app.models.user import User
from app.schemas.survey import (
    SurveyAnswerCount,
    SurveyQuestionCreateRequest,
    SurveyQuestionPublic,
    SurveyResultsResponse,
    SurveySubmitRequest,
    SurveySubmitResult,
)
from app.services import audit_service, interaction_service


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

    return SurveyQuestionPublic(
        id=sq.id,
        survey_interaction_id=survey_interaction_id,
        child_interaction_id=child.id,
        title=child.title,
        question_type=child.type,
        required=sq.required,
        page_no=sq.page_no,
        order_no=sq.order_no,
    )


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
    host: User,
) -> SurveyResultsResponse:
    """Survey 結果聚合（各子題作答數）。"""
    survey = await _load_survey_for_host(db, survey_interaction_id, host)

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

    for sq in sq_rows.scalars().all():
        resp_count = await db.execute(
            select(func.count())
            .select_from(PollResponse)
            .where(PollResponse.interaction_id == sq.child_interaction_id)
        )
        count = int(resp_count.scalar_one())
        option_counts: dict[str, int] | None = None

        child = await db.execute(
            select(Interaction).where(Interaction.id == sq.child_interaction_id)
        )
        child_i = child.scalar_one_or_none()
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
                response_count=count,
                option_counts=option_counts,
            )
        )

    return SurveyResultsResponse(
        survey_interaction_id=survey_interaction_id,
        submission_count=total_submissions,
        questions=questions,
    )
