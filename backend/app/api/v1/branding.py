"""公開品牌 API（S7-4）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import get_client_ip
from app.core.db import get_session
from app.schemas.admin import PublicBrandingResponse
from app.services import admin_service

router = APIRouter(prefix="/branding", tags=["branding"])


@router.get("/by-code/{code}", response_model=PublicBrandingResponse)
async def get_branding_by_code(
    code: str,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PublicBrandingResponse:
    """依活動代碼取得組織品牌（公開，無需認證）。"""
    return await admin_service.get_public_branding_by_code(
        db, code, client_ip=get_client_ip(request)
    )
