"""Session Overview 服務（Host 即時總覽；Phase 1 MVP）。"""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select, union
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.screen_reader_auth import ensure_screen_session
from app.core.tokens import ScreenTokenClaims
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollResponse as PollResponseRow
from app.models.question import Question
from app.models.room import Room
from app.models.session import Session
from app.models.sprint9 import QuizQuestion, SurveySubmission
from app.models.user import User
from app.schemas.overview import (
    ActivePollOverview,
    EngagementSummary,
    OverviewQuestionSummary,
    ParticipantHostItem,
    ParticipantListResponse,
    QuizLeaderboardTop,
    SessionOverviewResponse,
    SurveyOverviewSummary,
)
from app.schemas.poll import POLL_TYPES
from app.schemas.quiz import LeaderboardEntry
from app.serializers.mask_identity import mask_identity
from app.services import poll_service, qa_redis, quiz_service
from app.services.qa_service import _PUBLIC_LIST_STATUSES, _author_display

_DEFAULT_PARTICIPANT_PAGE = 20
_MAX_PARTICIPANT_PAGE = 100
_TOP_QUESTIONS_LIMIT = 5
_LEADERBOARD_TOP_LIMIT = 5


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


def _parse_cursor(cursor: str | None) -> int:
    if not cursor:
        return 0
    try:
        value = int(cursor)
    except ValueError:
        return 0
    return max(value, 0)


def _participant_item(participant: Participant) -> ParticipantHostItem:
    masked = mask_identity(
        {
            "display_name": participant.display_name,
            "is_anonymous": participant.is_anonymous,
            "participant_id": participant.id,
        }
    )
    item_id = None if participant.is_anonymous else participant.id
    return ParticipantHostItem(
        id=item_id,
        display_name=masked.get("display_name"),
        is_anonymous=participant.is_anonymous,
        joined_at=participant.joined_at,
    )


async def list_session_participants(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User | None = None,
    screen: ScreenTokenClaims | None = None,
    cursor: str | None = None,
    limit: int = _DEFAULT_PARTICIPANT_PAGE,
) -> ParticipantListResponse:
    """Host／Screen 參與者名單（分頁、mask_identity）。"""
    if screen is not None:
        await ensure_screen_session(db, screen, session_id)
    elif host is not None:
        await _get_session_for_host(db, session_id=session_id, host=host)
    else:
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少授權")
    page_size = min(max(limit, 1), _MAX_PARTICIPANT_PAGE)
    offset = _parse_cursor(cursor)

    total_result = await db.execute(
        select(func.count())
        .select_from(Participant)
        .where(
            Participant.session_id == session_id,
            Participant.is_preview.is_(False),
        )
    )
    total_count = int(total_result.scalar_one())

    rows_result = await db.execute(
        select(Participant)
        .where(
            Participant.session_id == session_id,
            Participant.is_preview.is_(False),
        )
        .order_by(Participant.joined_at.desc().nullslast(), Participant.id.desc())
        .offset(offset)
        .limit(page_size + 1)
    )
    rows = rows_result.scalars().all()
    has_more = len(rows) > page_size
    rows = rows[:page_size]

    next_cursor = str(offset + page_size) if has_more else None
    return ParticipantListResponse(
        items=[_participant_item(p) for p in rows],
        total_count=total_count,
        next_cursor=next_cursor,
    )


async def _engagement_summary(
    db: AsyncSession, *, session_id: uuid.UUID
) -> EngagementSummary:
    participant_count = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Participant)
                .where(
                    Participant.session_id == session_id,
                    Participant.is_preview.is_(False),
                )
            )
        ).scalar_one()
    )
    participants_qa = int(
        (
            await db.execute(
                select(func.count(func.distinct(Question.participant_id)))
                .select_from(Question)
                .where(
                    Question.session_id == session_id,
                    Question.participant_id.is_not(None),
                )
            )
        ).scalar_one()
    )
    participants_poll_voters = int(
        (
            await db.execute(
                select(func.count(func.distinct(PollResponseRow.participant_id)))
                .select_from(PollResponseRow)
                .join(Participant, PollResponseRow.participant_id == Participant.id)
                .where(Participant.session_id == session_id)
            )
        ).scalar_one()
    )
    qa_participant_ids = (
        select(Question.participant_id.label("participant_id"))
        .select_from(Question)
        .where(
            Question.session_id == session_id,
            Question.participant_id.is_not(None),
        )
    )
    poll_participant_ids = (
        select(PollResponseRow.participant_id.label("participant_id"))
        .select_from(PollResponseRow)
        .join(Participant, PollResponseRow.participant_id == Participant.id)
        .where(Participant.session_id == session_id)
    )
    engaged_ids = union(qa_participant_ids, poll_participant_ids).subquery()
    participants_engaged = int(
        (
            await db.execute(
                select(func.count()).select_from(engaged_ids)
            )
        ).scalar_one()
    )
    qa_questions_total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(Question)
                .where(Question.session_id == session_id)
            )
        ).scalar_one()
    )
    poll_votes_total = int(
        (
            await db.execute(
                select(func.count())
                .select_from(PollResponseRow)
                .join(Interaction, PollResponseRow.interaction_id == Interaction.id)
                .join(Room, Interaction.room_id == Room.id)
                .where(Room.session_id == session_id)
            )
        ).scalar_one()
    )
    engaged_percent = (
        round(participants_engaged / participant_count * 100)
        if participant_count > 0
        else 0
    )
    return EngagementSummary(
        participant_count=participant_count,
        participants_engaged=participants_engaged,
        engaged_percent=engaged_percent,
        qa_questions_total=qa_questions_total,
        poll_votes_total=poll_votes_total,
        participants_qa=participants_qa,
        participants_poll_voters=participants_poll_voters,
    )


async def _resolve_focus_room(
    db: AsyncSession, *, session_id: uuid.UUID, room_id: uuid.UUID | None
) -> uuid.UUID | None:
    if room_id is not None:
        result = await db.execute(
            select(Room.id).where(Room.id == room_id, Room.session_id == session_id)
        )
        resolved = result.scalar_one_or_none()
        if resolved is None:
            raise AppError(ErrorCode.NOT_FOUND, "找不到房間")
        return resolved
    result = await db.execute(
        select(Room.id)
        .where(Room.session_id == session_id)
        .order_by(Room.order_no.asc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def _top_questions(
    db: AsyncSession, *, session_id: uuid.UUID
) -> list[OverviewQuestionSummary]:
    stmt = (
        select(Question, Participant.display_name, Participant.is_anonymous)
        .outerjoin(Participant, Question.participant_id == Participant.id)
        .where(
            Question.session_id == session_id,
            Question.status.in_(_PUBLIC_LIST_STATUSES),
        )
        .order_by(Question.score.desc(), Question.created_at.desc(), Question.id.desc())
        .limit(_TOP_QUESTIONS_LIMIT)
    )
    rows = (await db.execute(stmt)).all()
    items: list[OverviewQuestionSummary] = []
    for question, display_name, participant_anonymous in rows:
        up, _, score = await qa_redis.get_effective_counts(db, question)
        author = _author_display(
            is_anonymous=question.is_anonymous or bool(participant_anonymous),
            display_name=display_name,
        )
        items.append(
            OverviewQuestionSummary(
                id=question.id,
                room_id=question.room_id,
                content=question.content,
                author_display=author,
                is_anonymous=question.is_anonymous,
                score=score,
                upvote_count=up,
            )
        )
    return items


async def _active_poll_overview(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User | None = None,
    screen_room_id: uuid.UUID | None = None,
) -> ActivePollOverview | None:
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.status == InteractionStatus.ACTIVE,
            Interaction.type.in_(tuple(POLL_TYPES)),
        )
    )
    interaction = result.scalars().first()
    if interaction is None:
        return None

    viewer_id = host.id if host is not None else screen_room_id
    if viewer_id is None:
        return None
    detail = await poll_service.get_poll_detail(
        db,
        interaction.id,
        viewer_id=viewer_id,
        is_host=True,
        screen_room_id=screen_room_id,
    )
    results = await poll_service.get_poll_results(
        db,
        interaction.id,
        is_host=True,
        screen_room_id=screen_room_id,
    )
    return ActivePollOverview(
        interaction_id=interaction.id,
        room_id=interaction.room_id,
        title=interaction.title,
        type=interaction.type,
        options=detail.options,
        results=results,
    )


async def _quiz_leaderboard_top(
    db: AsyncSession,
    *,
    room_id: uuid.UUID,
    host: User | None = None,
    screen: ScreenTokenClaims | None = None,
) -> QuizLeaderboardTop | None:
    quiz_child_ids = select(QuizQuestion.child_interaction_id)
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.type == InteractionType.QUIZ,
            Interaction.id.not_in(quiz_child_ids),
            or_(
                Interaction.status == InteractionStatus.ACTIVE,
                Interaction.status == InteractionStatus.LOCKED,
            ),
        )
    )
    quiz = result.scalars().first()
    if quiz is None:
        return None

    leaderboard = await quiz_service.get_leaderboard(
        db,
        quiz_interaction_id=quiz.id,
        host=host,
        screen=screen,
    )
    top_entries: list[LeaderboardEntry] = []
    for entry in leaderboard.entries[:_LEADERBOARD_TOP_LIMIT]:
        participant = await db.get(Participant, entry.participant_id)
        display_name = entry.display_name
        if participant is not None:
            masked = mask_identity(
                {
                    "display_name": participant.display_name,
                    "is_anonymous": participant.is_anonymous,
                }
            )
            display_name = masked.get("display_name")
        top_entries.append(
            LeaderboardEntry(
                participant_id=entry.participant_id,
                display_name=display_name,
                total_score=entry.total_score,
                total_elapsed_ms=entry.total_elapsed_ms,
                rank=entry.rank,
            )
        )
    return QuizLeaderboardTop(
        quiz_interaction_id=quiz.id,
        title=quiz.title,
        entries=top_entries,
    )


async def _survey_summary(
    db: AsyncSession, *, room_id: uuid.UUID
) -> SurveyOverviewSummary | None:
    result = await db.execute(
        select(Interaction).where(
            Interaction.room_id == room_id,
            Interaction.type == InteractionType.SURVEY,
            Interaction.status == InteractionStatus.ACTIVE,
        )
    )
    survey = result.scalars().first()
    if survey is None:
        return None

    submission_count = int(
        (
            await db.execute(
                select(func.count())
                .select_from(SurveySubmission)
                .where(
                    SurveySubmission.survey_interaction_id == survey.id,
                    SurveySubmission.completed.is_(True),
                )
            )
        ).scalar_one()
    )
    return SurveyOverviewSummary(
        survey_interaction_id=survey.id,
        title=survey.title,
        submission_count=submission_count,
    )


async def get_session_overview(
    db: AsyncSession,
    *,
    session_id: uuid.UUID,
    host: User | None = None,
    screen: ScreenTokenClaims | None = None,
    room_id: uuid.UUID | None = None,
) -> SessionOverviewResponse:
    """Host／Screen 單一活動即時總覽（KPI + active poll + top Q&A + quiz/survey 摘要）。"""
    if screen is not None:
        await ensure_screen_session(db, screen, session_id, room_id=room_id)
        sess_row = await db.execute(
            select(Session).where(Session.id == session_id)
        )
        session = sess_row.scalar_one_or_none()
        if session is None:
            raise AppError(ErrorCode.NOT_FOUND, "找不到活動")
    elif host is not None:
        session = await _get_session_for_host(db, session_id=session_id, host=host)
    else:
        raise AppError(ErrorCode.UNAUTHENTICATED, "缺少授權")
    focus_room_id = await _resolve_focus_room(
        db, session_id=session_id, room_id=room_id
    )
    engagement = await _engagement_summary(db, session_id=session_id)
    top_questions = await _top_questions(db, session_id=session_id)

    active_poll = None
    quiz_leaderboard_top = None
    survey_summary = None
    if focus_room_id is not None:
        if screen is not None:
            active_poll = await _active_poll_overview(
                db,
                room_id=focus_room_id,
                screen_room_id=screen.room_id,
            )
            quiz_leaderboard_top = await _quiz_leaderboard_top(
                db, room_id=focus_room_id, screen=screen
            )
        else:
            active_poll = await _active_poll_overview(
                db, room_id=focus_room_id, host=host
            )
            quiz_leaderboard_top = await _quiz_leaderboard_top(
                db, room_id=focus_room_id, host=host
            )
        survey_summary = await _survey_summary(db, room_id=focus_room_id)

    return SessionOverviewResponse(
        session_id=session.id,
        title=session.title,
        status=session.status,
        focus_room_id=focus_room_id,
        participant_count=engagement.participant_count,
        engagement=engagement,
        active_poll=active_poll,
        top_questions=top_questions,
        quiz_leaderboard_top=quiz_leaderboard_top,
        survey_summary=survey_summary,
    )
