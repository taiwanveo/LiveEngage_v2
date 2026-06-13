"""participants 資料表（SDS §7.2）。"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import AuthMethod


class Participant(UUIDPrimaryKeyMixin, Base):
    """參與者（免帳號加入；匿名遮蔽見 serializers.mask_identity）。"""

    __tablename__ = "participants"

    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    room_id: Mapped[uuid.UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("rooms.id", ondelete="SET NULL"),
        nullable=True,
    )
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    auth_method: Mapped[AuthMethod] = mapped_column(
        pg_enum(AuthMethod, "auth_method"),
        nullable=False,
        default=AuthMethod.NONE,
    )
    device_fingerprint: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_preview: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    joined_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_seen_at: Mapped[dt.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("idx_participants_session", "session_id", "last_seen_at"),
    )
