"""WS 事件信封（SDS §6.2）。"""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.core.ids import uuid7


class EventEnvelope(BaseModel):
    """即時事件標準信封；id 供 replay 與去重。"""

    id: str = Field(default_factory=lambda: f"evt_{uuid7()}")
    type: str
    room_id: uuid.UUID
    ts: dt.datetime = Field(default_factory=lambda: dt.datetime.now(dt.UTC))
    payload: dict[str, Any]
    target_modes: list[str] | None = Field(
        default=None,
        serialization_alias="_target_modes",
        description="WS 廣播 mode 過濾（Pub/Sub 跨副本傳遞）",
    )
