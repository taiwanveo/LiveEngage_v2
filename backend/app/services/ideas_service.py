"""Ideas Board 業務邏輯（FE-013）。"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.ids import uuid7
from app.core.tokens import ParticipantTokenClaims
from app.models.enums import InteractionStatus, InteractionType
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.sprint9 import Idea, IdeaReaction
from app.models.user import User
from app.realtime import events
from app.schemas.ideas import (
    IdeaListResponse,
    IdeaPublic,
    IdeaReactRequest,
    IdeaReactionSummary,
    IdeaSort,
    IdeaSubmitRequest,
)
from app.services import audit_service, interaction_service


async def _load_board_interaction(
    db: AsyncSession, board_interaction_id: uuid.UUID
) -> Interaction:
    result = await db.execute(
        select(Interaction).where(Interaction.id == board_interaction_id)
    )
    board = result.scalar_one_or_none()
    if board is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到 Ideas Board")
    if board.type != InteractionType.IDEAS:
        raise AppError(ErrorCode.VALIDATION_ERROR, "此互動項目不是 Ideas Board")
    return board


async def _reactions_for_ideas(
    db: AsyncSession,
    idea_ids: list[uuid.UUID],
    viewer_participant_id: uuid.UUID | None,
) -> dict[uuid.UUID, list[IdeaReactionSummary]]:
    if not idea_ids:
        return {}
    counts = await db.execute(
        select(IdeaReaction.idea_id, IdeaReaction.emoji, func.count())
        .where(IdeaReaction.idea_id.in_(idea_ids))
        .group_by(IdeaReaction.idea_id, IdeaReaction.emoji)
    )
    my_reactions: set[tuple[uuid.UUID, str]] = set()
    if viewer_participant_id is not None:
        mine = await db.execute(
            select(IdeaReaction.idea_id, IdeaReaction.emoji).where(
                IdeaReaction.participant_id == viewer_participant_id,
                IdeaReaction.idea_id.in_(idea_ids),
            )
        )
        my_reactions = {(row[0], row[1]) for row in mine.all()}

    grouped: dict[uuid.UUID, list[IdeaReactionSummary]] = {iid: [] for iid in idea_ids}
    for idea_id, emoji, count in counts.all():
        grouped[idea_id].append(
            IdeaReactionSummary(
                emoji=emoji,
                count=int(count),
                reacted_by_me=(idea_id, emoji) in my_reactions,
            )
        )
    return grouped


def _to_public(
    idea: Idea,
    *,
    author_display: str | None,
    reactions: list[IdeaReactionSummary],
) -> IdeaPublic:
    total = sum(r.count for r in reactions)
    return IdeaPublic(
        id=idea.id,
        board_interaction_id=idea.board_interaction_id,
        content=idea.content,
        category=idea.category,
        is_hidden=idea.is_hidden,
        author_display=author_display,
        created_at=idea.created_at,
        reactions=reactions,
        reaction_total=total,
    )


async def submit_idea(
    db: AsyncSession,
    *,
    board_interaction_id: uuid.UUID,
    claims: ParticipantTokenClaims,
    payload: IdeaSubmitRequest,
) -> IdeaPublic:
    """參與者提交點子。"""
    board = await _load_board_interaction(db, board_interaction_id)
    if board.status != InteractionStatus.ACTIVE:
        raise AppError(ErrorCode.POLL_INVALID_STATE, "Ideas Board 尚未開放")

    if claims.room_id != board.room_id:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此房間")

    content = payload.content.strip()
    if not content:
        raise AppError(ErrorCode.VALIDATION_ERROR, "內容不可為空")

    now = dt.datetime.now(dt.UTC)
    idea = Idea(
        id=uuid7(),
        board_interaction_id=board_interaction_id,
        participant_id=claims.participant_id,
        content=content,
        category=payload.category,
        is_hidden=False,
        created_at=now,
    )
    db.add(idea)
    await db.commit()
    await db.refresh(idea)

    display_name = await db.execute(
        select(Participant.display_name).where(
            Participant.id == claims.participant_id
        )
    )
    name = display_name.scalar_one_or_none()
    public = _to_public(idea, author_display=name, reactions=[])

    await events.publish(
        board.room_id,
        events.IDEA_SUBMITTED,
        {"idea": public.model_dump(mode="json")},
    )
    return public


async def list_ideas(
    db: AsyncSession,
    *,
    board_interaction_id: uuid.UUID,
    sort: IdeaSort = IdeaSort.NEWEST,
    participant_id: uuid.UUID | None = None,
    is_host: bool = False,
) -> IdeaListResponse:
    """列出點子；參與者看不到 hidden。"""
    board = await _load_board_interaction(db, board_interaction_id)
    stmt = (
        select(Idea, Participant.display_name)
        .outerjoin(Participant, Idea.participant_id == Participant.id)
        .where(Idea.board_interaction_id == board_interaction_id)
    )
    if not is_host:
        stmt = stmt.where(Idea.is_hidden.is_(False))

    if sort == IdeaSort.NEWEST:
        stmt = stmt.order_by(Idea.created_at.desc())
    else:
        stmt = stmt.order_by(Idea.created_at.desc())

    rows = (await db.execute(stmt)).all()
    idea_ids = [row[0].id for row in rows]
    reactions_map = await _reactions_for_ideas(db, idea_ids, participant_id)

    items = [
        _to_public(
            idea,
            author_display=name,
            reactions=reactions_map.get(idea.id, []),
        )
        for idea, name in rows
    ]
    if sort == IdeaSort.TOP:
        items.sort(key=lambda x: (-x.reaction_total, -x.created_at.timestamp()))
    return IdeaListResponse(items=items)


async def react(
    db: AsyncSession,
    *,
    idea_id: uuid.UUID,
    claims: ParticipantTokenClaims,
    payload: IdeaReactRequest,
) -> IdeaPublic:
    """Emoji 反應切換（有則刪、無則加）。"""
    result = await db.execute(
        select(Idea, Interaction)
        .join(Interaction, Idea.board_interaction_id == Interaction.id)
        .where(Idea.id == idea_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到點子")
    idea, board = row[0], row[1]

    if idea.is_hidden:
        raise AppError(ErrorCode.NOT_FOUND, "找不到點子")
    if claims.room_id != board.room_id:
        raise AppError(ErrorCode.FORBIDDEN, "您未加入此房間")
    if board.status != InteractionStatus.ACTIVE:
        raise AppError(ErrorCode.POLL_INVALID_STATE, "Ideas Board 尚未開放")

    emoji = payload.emoji.strip()
    existing = await db.execute(
        select(IdeaReaction).where(
            IdeaReaction.idea_id == idea_id,
            IdeaReaction.participant_id == claims.participant_id,
            IdeaReaction.emoji == emoji,
        )
    )
    reaction = existing.scalar_one_or_none()
    now = dt.datetime.now(dt.UTC)
    if reaction is not None:
        await db.execute(delete(IdeaReaction).where(IdeaReaction.id == reaction.id))
    else:
        db.add(
            IdeaReaction(
                id=uuid7(),
                idea_id=idea_id,
                participant_id=claims.participant_id,
                emoji=emoji,
                created_at=now,
            )
        )
    await db.commit()

    reactions_map = await _reactions_for_ideas(
        db, [idea_id], claims.participant_id
    )
    name_result = await db.execute(
        select(Participant.display_name).where(
            Participant.id == idea.participant_id
        )
    )
    public = _to_public(
        idea,
        author_display=name_result.scalar_one_or_none(),
        reactions=reactions_map.get(idea_id, []),
    )

    await events.publish(
        board.room_id,
        events.IDEA_REACTED,
        {
            "idea_id": str(idea_id),
            "reactions": [r.model_dump(mode="json") for r in public.reactions],
            "reaction_total": public.reaction_total,
        },
    )
    return public


async def hide_idea(
    db: AsyncSession,
    *,
    idea_id: uuid.UUID,
    host: User,
) -> IdeaPublic:
    """Host 隱藏點子。"""
    result = await db.execute(
        select(Idea, Interaction)
        .join(Interaction, Idea.board_interaction_id == Interaction.id)
        .where(Idea.id == idea_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到點子")
    idea, board = row[0], row[1]
    await interaction_service.ensure_room_access(db, board.room_id, host)

    idea.is_hidden = True
    await audit_service.log(
        db,
        actor=host,
        action="ideas.hide",
        target_type="idea",
        target_id=idea_id,
        room_id=board.room_id,
    )
    await db.commit()
    await db.refresh(idea)

    reactions_map = await _reactions_for_ideas(db, [idea_id], None)
    public = _to_public(
        idea,
        author_display=None,
        reactions=reactions_map.get(idea_id, []),
    )

    await events.publish(
        board.room_id,
        events.IDEA_VISIBILITY_CHANGED,
        {"idea_id": str(idea_id), "is_hidden": True},
    )
    return public


async def show_idea(
    db: AsyncSession,
    *,
    idea_id: uuid.UUID,
    host: User,
) -> IdeaPublic:
    """Host 取消隱藏點子。"""
    result = await db.execute(
        select(Idea, Interaction)
        .join(Interaction, Idea.board_interaction_id == Interaction.id)
        .where(Idea.id == idea_id)
    )
    row = result.first()
    if row is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到點子")
    idea, board = row[0], row[1]
    await interaction_service.ensure_room_access(db, board.room_id, host)

    idea.is_hidden = False
    await audit_service.log(
        db,
        actor=host,
        action="ideas.show",
        target_type="idea",
        target_id=idea_id,
        room_id=board.room_id,
    )
    await db.commit()
    await db.refresh(idea)

    reactions_map = await _reactions_for_ideas(db, [idea_id], None)
    public = _to_public(
        idea,
        author_display=None,
        reactions=reactions_map.get(idea_id, []),
    )

    await events.publish(
        board.room_id,
        events.IDEA_VISIBILITY_CHANGED,
        {"idea_id": str(idea_id), "is_hidden": False},
    )
    return public
