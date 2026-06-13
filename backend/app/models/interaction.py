"""interactions 資料表（SDS §7.2）。

partial index ``idx_interactions_active``（``WHERE status='active'``）於
migration 以原生 DDL 建立。
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import InteractionStatus, InteractionType


class Interaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """互動項目（Q&A / Poll / Quiz / Survey / Ideas 的統一表）。"""

    __tablename__ = "interactions"

    room_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[InteractionType] = mapped_column(
        pg_enum(InteractionType, "interaction_type"),
        nullable=False,
    )
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[InteractionStatus] = mapped_column(
        pg_enum(InteractionStatus, "interaction_status"),
        nullable=False,
        default=InteractionStatus.IDLE,
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 題型設定（匿名 / 顯示結果 / 允許修改 / 亂序 / 限時 / 敏感詞…）
    settings_jsonb: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    result_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    started_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    stopped_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (Index("idx_interactions_room", "room_id", "order_no"),)
