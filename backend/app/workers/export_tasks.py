"""Celery 匯出任務（BE-012）。"""

from __future__ import annotations

import asyncio
import logging
import uuid

from app.core.config import get_settings
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="export.run_job", bind=True, max_retries=2)
def run_export_job(self, job_id: str) -> None:
    """非同步產生匯出檔並寫入 Redis。"""
    try:
        asyncio.run(_run_export_job_async(uuid.UUID(job_id)))
    except Exception as exc:
        logger.exception("匯出任務失敗 job=%s", job_id)
        asyncio.run(_mark_failed(uuid.UUID(job_id), str(exc)))
        raise


async def _run_export_job_async(job_id: uuid.UUID) -> None:
    import datetime as dt

    from sqlalchemy import select

    from app.core.db import get_sessionmaker
    from app.models.enums import ExportStatus
    from app.models.export_job import ExportJob
    from app.services import export_service
    from app.services.export_storage import store_export_file

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as db:
        result = await db.execute(select(ExportJob).where(ExportJob.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            logger.error("找不到 export job %s", job_id)
            return

        job.status = ExportStatus.PROCESSING
        await db.commit()

        try:
            content, _media, _filename = await export_service.build_export_bytes(db, job)
            if job.expires_at is None:
                job.expires_at = dt.datetime.utcnow() + dt.timedelta(hours=72)
            await store_export_file(job.id, content, expires_at=job.expires_at)
            job.status = ExportStatus.COMPLETED
            job.completed_at = dt.datetime.utcnow()
            job.error_message = None
        except Exception as exc:
            job.status = ExportStatus.FAILED
            job.error_message = str(exc)[:500]
            raise
        finally:
            await db.commit()


async def _mark_failed(job_id: uuid.UUID, message: str) -> None:
    from sqlalchemy import select

    from app.core.db import get_sessionmaker
    from app.models.enums import ExportStatus
    from app.models.export_job import ExportJob

    sessionmaker = get_sessionmaker()
    async with sessionmaker() as db:
        result = await db.execute(select(ExportJob).where(ExportJob.id == job_id))
        job = result.scalar_one_or_none()
        if job is None:
            return
        job.status = ExportStatus.FAILED
        job.error_message = message[:500]
        await db.commit()


def enqueue_export_job(job_id: uuid.UUID) -> None:
    """派送 Celery 任務；``LE_CELERY_TASK_ALWAYS_EAGER=true`` 時同步執行。"""
    import asyncio
    import concurrent.futures

    from app.core.config import get_settings

    if get_settings().celery_task_always_eager:

        def _runner() -> None:
            asyncio.run(_run_export_job_async(job_id))

        try:
            asyncio.get_running_loop()
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                ex.submit(_runner).result()
        except RuntimeError:
            _runner()
    else:
        run_export_job.delay(str(job_id))
