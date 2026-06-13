"""Celery 應用設定（broker = Redis）。"""

from __future__ import annotations

import ssl

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "liveengage",
    broker=settings.celery_broker_url,
    backend=settings.celery_broker_url,
    include=["app.workers.export_tasks"],
)

_conf: dict[str, object] = {
    "task_serializer": "json",
    "accept_content": ["json"],
    "result_serializer": "json",
    "timezone": "UTC",
    "enable_utc": True,
    "task_always_eager": settings.celery_task_always_eager,
    "task_eager_propagates": True,
}

# Upstash 等 TLS Redis（rediss://）需明確 SSL 設定
if settings.celery_broker_url.startswith("rediss://"):
    _ssl = {"ssl_cert_reqs": ssl.CERT_NONE}
    _conf["broker_use_ssl"] = _ssl
    _conf["redis_backend_use_ssl"] = _ssl

celery_app.conf.update(**_conf)
