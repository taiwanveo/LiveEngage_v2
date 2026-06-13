"""Integrations（Webhook 存於 org settings_jsonb）。"""

from __future__ import annotations

import datetime as dt
import secrets
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.models.user import User
from app.schemas.integration import (
    WebhookCreateRequest,
    WebhookListResponse,
    WebhookResponse,
)
from app.services import admin_service, audit_service

_WEBHOOKS_KEY = "webhooks"


def _load_webhooks(raw: dict[str, Any]) -> list[dict[str, Any]]:
    items = raw.get(_WEBHOOKS_KEY) if isinstance(raw, dict) else []
    return items if isinstance(items, list) else []


async def list_webhooks(db: AsyncSession, actor: User) -> WebhookListResponse:
    org = await admin_service._get_org_or_403(db, actor)  # noqa: SLF001
    items = [
        WebhookResponse.model_validate(item)
        for item in _load_webhooks(org.settings_jsonb or {})
    ]
    return WebhookListResponse(items=items)


async def create_webhook(
    db: AsyncSession,
    *,
    actor: User,
    payload: WebhookCreateRequest,
) -> WebhookResponse:
    org = await admin_service._get_org_or_403(db, actor)  # noqa: SLF001
    settings = dict(org.settings_jsonb or {})
    webhooks = _load_webhooks(settings)
    entry = {
        "id": secrets.token_urlsafe(12),
        "url": str(payload.url),
        "events": payload.events,
        "enabled": True,
        "secret": payload.secret or secrets.token_urlsafe(24),
        "created_at": dt.datetime.now(dt.UTC).isoformat(),
    }
    webhooks.append(entry)
    settings[_WEBHOOKS_KEY] = webhooks
    org.settings_jsonb = settings
    await audit_service.log(
        db,
        actor=actor,
        action="integration.webhook.create",
        target_type="webhook",
        target_id=None,
        details={"url": str(payload.url), "events": payload.events},
    )
    await db.commit()
    await db.refresh(org)
    return WebhookResponse.model_validate(
        {k: v for k, v in entry.items() if k != "secret"}
    )


async def delete_webhook(
    db: AsyncSession,
    *,
    actor: User,
    webhook_id: str,
) -> None:
    org = await admin_service._get_org_or_403(db, actor)  # noqa: SLF001
    settings = dict(org.settings_jsonb or {})
    webhooks = _load_webhooks(settings)
    new_list = [w for w in webhooks if w.get("id") != webhook_id]
    if len(new_list) == len(webhooks):
        raise AppError(ErrorCode.NOT_FOUND, "找不到 Webhook")
    settings[_WEBHOOKS_KEY] = new_list
    org.settings_jsonb = settings
    await audit_service.log(
        db,
        actor=actor,
        action="integration.webhook.delete",
        target_type="webhook",
        target_id=None,
        details={"webhook_id": webhook_id},
    )
    await db.commit()
