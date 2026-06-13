"""Integrations / Webhook schema（存於 org settings_jsonb）。"""

from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class WebhookResponse(BaseModel):
    id: str
    url: str
    events: list[str]
    enabled: bool = True
    created_at: str


class WebhookCreateRequest(BaseModel):
    url: HttpUrl
    events: list[str] = Field(default_factory=lambda: ["session.live", "poll.started"])
    secret: str | None = Field(default=None, min_length=8, max_length=128)


class WebhookListResponse(BaseModel):
    items: list[WebhookResponse] = Field(default_factory=list)
