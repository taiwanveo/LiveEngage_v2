"""活動資料匯出（BE-012）。

建立匯出任務、產生 CSV/XLSX、72h 簽名下載連結。
匯出內容經 ``mask_identity`` 遮蔽匿名參與者（鐵律 3）。
"""

from __future__ import annotations

import csv
import datetime as dt
import io
import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError, ErrorCode
from app.core.export_signing import _naive_utc, create_download_token, sign_download
from app.core.ids import uuid7
from app.models.enums import ExportFormat, ExportStatus
from app.models.export_job import ExportJob
from app.models.interaction import Interaction
from app.models.participant import Participant
from app.models.poll import PollResponse
from app.models.question import Question
from app.models.room import Room
from app.models.session import Session
from app.models.user import User
from app.schemas.admin import (
    ExportCreateRequest,
    ExportJobListResponse,
    ExportJobResponse,
)
from app.serializers.mask_identity import mask_identity
from app.services import audit_service
from app.workers.export_tasks import enqueue_export_job

EXPORT_TTL_HOURS = 72


def _to_job_response(job: ExportJob, *, base_url: str = "") -> ExportJobResponse:
    download_url: str | None = None
    if (
        job.status == ExportStatus.COMPLETED
        and job.download_token
        and job.expires_at
    ):
        sig = sign_download(job.id, job.download_token, job.expires_at)
        ts = int(_naive_utc(job.expires_at).timestamp())
        download_url = (
            f"{base_url}/api/v1/exports/{job.id}/download"
            f"?token={job.download_token}&exp={ts}&sig={sig}"
        )
    return ExportJobResponse(
        id=job.id,
        session_id=job.session_id,
        format=job.format.value,
        status=job.status.value,
        download_url=download_url,
        expires_at=job.expires_at,
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


async def _get_session_in_org(
    db: AsyncSession, *, session_id: uuid.UUID, org_id: uuid.UUID
) -> Session:
    result = await db.execute(
        select(Session).where(Session.id == session_id, Session.org_id == org_id)
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到活動")
    return session


async def create_export_job(
    db: AsyncSession,
    *,
    actor: User,
    payload: ExportCreateRequest,
    base_url: str = "",
) -> ExportJobResponse:
    """建立匯出任務並派送 Celery Worker（BE-012）。"""
    await _get_session_in_org(db, session_id=payload.session_id, org_id=actor.org_id)

    fmt = ExportFormat(payload.format)
    token = create_download_token()
    now = dt.datetime.utcnow()
    expires_at = now + dt.timedelta(hours=EXPORT_TTL_HOURS)

    job = ExportJob(
        id=uuid7(),
        org_id=actor.org_id,
        session_id=payload.session_id,
        requested_by=actor.id,
        format=fmt,
        status=ExportStatus.PENDING,
        download_token=token,
        expires_at=expires_at,
    )
    db.add(job)
    await audit_service.log(
        db,
        actor=actor,
        action="create_export",
        target_type="export_job",
        target_id=job.id,
        session_id=payload.session_id,
        details={"format": fmt.value},
    )
    await db.commit()
    await db.refresh(job)

    enqueue_export_job(job.id)
    await db.refresh(job)

    return _to_job_response(job, base_url=base_url)


async def list_export_jobs(
    db: AsyncSession,
    *,
    actor: User,
    session_id: uuid.UUID | None = None,
    base_url: str = "",
) -> ExportJobListResponse:
    """列出組織匯出任務。"""
    q = select(ExportJob).where(ExportJob.org_id == actor.org_id)
    if session_id:
        q = q.where(ExportJob.session_id == session_id)
    q = q.order_by(ExportJob.created_at.desc()).limit(50)
    rows = await db.execute(q)
    items = [_to_job_response(j, base_url=base_url) for j in rows.scalars().all()]
    count_q = select(func.count()).select_from(
        select(ExportJob).where(ExportJob.org_id == actor.org_id).subquery()
    )
    total = (await db.execute(count_q)).scalar_one()
    return ExportJobListResponse(items=items, total=total)


async def get_export_job(
    db: AsyncSession, job_id: uuid.UUID
) -> ExportJob | None:
    result = await db.execute(select(ExportJob).where(ExportJob.id == job_id))
    return result.scalar_one_or_none()


async def resolve_download(
    db: AsyncSession, job: ExportJob
) -> tuple[bytes, str, str]:
    """自 Redis 快取或即時產生匯出檔。"""
    from app.services.export_storage import load_export_file

    cached = await load_export_file(job.id)
    if cached is not None:
        session_result = await db.execute(
            select(Session).where(Session.id == job.session_id)
        )
        session = session_result.scalar_one()
        media_type, filename = _download_headers(job, session.code)
        return cached, media_type, filename
    return await build_export_bytes(db, job)


def _download_headers(job: ExportJob, session_code: str) -> tuple[str, str]:
    if job.format == ExportFormat.XLSX:
        return (
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"export-{session_code}.xlsx",
        )
    return "text/csv", f"export-{session_code}.csv"


async def build_export_bytes(db: AsyncSession, job: ExportJob) -> tuple[bytes, str, str]:
    """彙整活動資料並產生檔案 bytes。回傳 (content, media_type, filename)。"""
    session_result = await db.execute(
        select(Session).where(Session.id == job.session_id)
    )
    session = session_result.scalar_one()

    participants = (
        await db.execute(
            select(Participant).where(Participant.session_id == job.session_id)
        )
    ).scalars().all()

    questions = (
        await db.execute(
            select(Question).where(Question.session_id == job.session_id)
        )
    ).scalars().all()

    poll_responses = (
        await db.execute(
            select(PollResponse)
            .join(Interaction, PollResponse.interaction_id == Interaction.id)
            .join(Room, Interaction.room_id == Room.id)
            .where(Room.session_id == job.session_id)
        )
    ).scalars().all()

    rows: list[dict[str, Any]] = []

    rows.append({"section": "session", "field": "title", "value": session.title})
    rows.append({"section": "session", "field": "code", "value": session.code})
    rows.append({"section": "session", "field": "status", "value": session.status.value})

    for p in participants:
        masked = mask_identity(
            {
                "display_name": p.display_name,
                "email": p.email,
                "is_anonymous": p.is_anonymous,
            }
        )
        rows.append({
            "section": "participant",
            "field": "display_name",
            "value": masked.get("display_name"),
            "email": masked.get("email"),
        })

    for q in questions:
        rows.append({
            "section": "question",
            "field": "text",
            "value": q.content,
            "status": q.status.value,
            "upvotes": q.upvote_count,
        })

    for pr in poll_responses:
        rows.append({
            "section": "poll_response",
            "field": "answer",
            "value": str(pr.answer_jsonb),
        })

    if job.format == ExportFormat.CSV:
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        else:
            buf.write("section,field,value\n")
        content = buf.getvalue().encode("utf-8-sig")
        return content, "text/csv", f"export-{session.code}.csv"

    # XLSX via openpyxl（若未安裝則 fallback CSV）
    try:
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.title = "Export"
        if rows:
            headers = list(rows[0].keys())
            ws.append(headers)
            for row in rows:
                ws.append([row.get(h) for h in headers])
        buf_xlsx = io.BytesIO()
        wb.save(buf_xlsx)
        return (
            buf_xlsx.getvalue(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            f"export-{session.code}.xlsx",
        )
    except ImportError:
        buf = io.StringIO()
        if rows:
            writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
        return buf.getvalue().encode("utf-8-sig"), "text/csv", f"export-{session.code}.csv"
