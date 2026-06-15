"""對外可存取的 API 基底 URL（簽名連結、SSO callback 等）。"""

from __future__ import annotations

from fastapi import Request

from app.core.config import get_settings

_LOCAL_DEFAULT = "http://localhost:8000"


def api_public_base_url(*, request: Request | None = None) -> str:
    """優先 ``LE_API_PUBLIC_URL``；否則 fallback 至請求的 ``base_url``。"""
    configured = get_settings().api_public_url.rstrip("/")
    if configured and configured != _LOCAL_DEFAULT:
        return configured
    if request is not None:
        return str(request.base_url).rstrip("/")
    return configured or _LOCAL_DEFAULT
