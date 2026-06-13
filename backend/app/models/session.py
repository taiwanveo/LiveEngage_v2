"""sessions 資料表（SDS §7.2）。

注意：唯一索引 ``uq_sessions_code_active`` 為 partial + 函式索引
（``lower(code) WHERE status IN ('draft','live')``），於 migration 以原生
DDL 建立，不在此處 ORM 宣告（避免方言差異）。
"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import SessionStatus, SessionVisibility


class Session(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """活動（一場可承載多個房間與互動項目的空間）。"""

    __tablename__ = "sessions"

    org_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    host_user_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(10), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    start_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    end_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        pg_enum(SessionStatus, "session_status"),
        nullable=False,
        default=SessionStatus.DRAFT,
    )
    visibility: Mapped[SessionVisibility] = mapped_column(
        pg_enum(SessionVisibility, "session_visibility"),
        nullable=False,
        default=SessionVisibility.PUBLIC,
    )
    # 鐵律 9：passcode 以 argon2id 雜湊儲存
    passcode_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    settings_jsonb: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    archived_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)

    __table_args__ = (Index("idx_sessions_org", "org_id", "status"),)
