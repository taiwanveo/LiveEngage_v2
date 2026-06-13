"""ORM 宣告基底與共用 mixin。

- ``Base``：SQLAlchemy 2.0 DeclarativeBase。
- ``UUIDPrimaryKeyMixin``：UUID v7 主鍵（鐵律 7）。
- ``TimestampMixin``：created_at / updated_at（UTC，鐵律 7）。

註：SDS §7.1 指定 updated_at 由 DB trigger 維護；本回合先以 SQLAlchemy
``onupdate`` 維護，trigger 化留待 migration 規範補強（見 ARCHITECTURE 待辦）。
"""

from __future__ import annotations

import datetime as dt
import uuid

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from app.core.ids import uuid7


class Base(DeclarativeBase):
    """所有 ORM 模型的宣告基底。"""


class UUIDPrimaryKeyMixin:
    """UUID v7 主鍵。"""

    id: Mapped[uuid.UUID] = mapped_column(
        PgUUID(as_uuid=True),
        primary_key=True,
        default=uuid7,
    )


class TimestampMixin:
    """UTC 建立 / 更新時間。"""

    created_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
