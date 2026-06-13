"""export_jobs 資料表（SDS §7.2、BE-012）。"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin, pg_enum
from app.models.enums import ExportFormat, ExportStatus


class ExportJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """活動資料匯出任務。"""

    __tablename__ = "export_jobs"

    org_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    requested_by: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    format: Mapped[ExportFormat] = mapped_column(
        pg_enum(ExportFormat, "export_format"),
        nullable=False,
    )
    status: Mapped[ExportStatus] = mapped_column(
        pg_enum(ExportStatus, "export_status"),
        nullable=False,
        default=ExportStatus.PENDING,
    )
    download_token: Mapped[str | None] = mapped_column(String(128), nullable=True)
    expires_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[dt.datetime | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(String(500), nullable=True)
