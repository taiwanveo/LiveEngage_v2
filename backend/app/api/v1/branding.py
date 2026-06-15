"""公開品牌 API（S7-4）。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import get_client_ip
from app.core.db import get_session
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.admin import PublicBrandingResponse
from app.services import admin_service

router = APIRouter(prefix="/branding", tags=["branding"])


@router.get("/me", response_model=PublicBrandingResponse)
async def get_branding_me(
    db: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[User, Depends(get_current_user)],
) -> PublicBrandingResponse:
    """已登入使用者讀取所屬組織品牌（Host 頂欄 Logo／名稱）。"""
    return await admin_service.get_branding_for_user(db, user)


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


@router.get("/site", response_model=PublicBrandingResponse)
async def get_site_branding(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> PublicBrandingResponse:
    """站點預設組織品牌（Admin 登入頁，公開）。"""
    return await admin_service.get_site_branding(db)
