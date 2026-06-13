"""Celery 應用設定（broker = Redis）。"""

from __future__ import annotations

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "liveengage",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,
    include=["app.workers.export_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=True,
)
