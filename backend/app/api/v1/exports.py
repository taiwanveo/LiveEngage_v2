"""匯出下載 API（BE-012，72h 簽名連結）。"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError, ErrorCode
from app.core.export_signing import verify_download
from app.models.enums import ExportStatus
from app.services import export_service

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/{job_id}/download")
async def download_export(
    job_id: uuid.UUID,
    db: Annotated[AsyncSession, Depends(get_session)],
    token: Annotated[str, Query(min_length=1)],
    exp: Annotated[int, Query()],
    sig: Annotated[str, Query(min_length=1)],
) -> Response:
    """以簽名連結下載匯出檔（72h 有效，無需 JWT）。"""
    job = await export_service.get_export_job(db, job_id)
    if job is None:
        raise AppError(ErrorCode.NOT_FOUND, "找不到匯出任務")
    if job.status != ExportStatus.COMPLETED or not job.download_token:
        raise AppError(ErrorCode.EXPORT_LINK_EXPIRED, "匯出連結無效")
    if job.download_token != token:
        raise AppError(ErrorCode.FORBIDDEN, "匯出連結無效")
    if job.expires_at is None or not verify_download(
        job.id, token, job.expires_at, sig
    ):
        raise AppError(ErrorCode.EXPORT_LINK_EXPIRED, "匯出連結已過期")

    import datetime as dt

    now = dt.datetime.now(dt.UTC)
    exp = job.expires_at if job.expires_at.tzinfo else job.expires_at.replace(tzinfo=dt.UTC)
    if now > exp:
        raise AppError(ErrorCode.EXPORT_LINK_EXPIRED, "匯出連結已過期")

    content, media_type, filename = await export_service.resolve_download(db, job)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
