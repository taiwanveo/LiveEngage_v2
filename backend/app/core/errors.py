"""標準錯誤格式與錯誤碼（SDS §5.6）。

對外錯誤一律輸出信封：
``{"error": {"code","message","details","request_id"}}``
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class ErrorCode(StrEnum):
    """SDS §5.6 錯誤碼表。"""

    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    FORBIDDEN = "FORBIDDEN"
    AI_DISABLED = "AI_DISABLED"
    ANON_NOT_ALLOWED = "ANON_NOT_ALLOWED"
    SESSION_NOT_FOUND = "SESSION_NOT_FOUND"
    NOT_FOUND = "NOT_FOUND"
    POLL_INVALID_STATE = "POLL_INVALID_STATE"
    POLL_LOCKED = "POLL_LOCKED"
    ALREADY_RESPONDED = "ALREADY_RESPONDED"
    QA_CLOSED = "QA_CLOSED"
    SESSION_NOT_LIVE = "SESSION_NOT_LIVE"
    SESSION_ENDED = "SESSION_ENDED"
    EXPORT_LINK_EXPIRED = "EXPORT_LINK_EXPIRED"
    PASSCODE_INVALID = "PASSCODE_INVALID"
    EMAIL_DOMAIN_RESTRICTED = "EMAIL_DOMAIN_RESTRICTED"
    CONTENT_FILTERED = "CONTENT_FILTERED"
    RATE_LIMITED = "RATE_LIMITED"
    INTERNAL = "INTERNAL"
    AI_UNAVAILABLE = "AI_UNAVAILABLE"


# 錯誤碼 → 預設 HTTP 狀態碼
_DEFAULT_HTTP: dict[ErrorCode, int] = {
    ErrorCode.VALIDATION_ERROR: status.HTTP_400_BAD_REQUEST,
    ErrorCode.UNAUTHENTICATED: status.HTTP_401_UNAUTHORIZED,
    ErrorCode.FORBIDDEN: status.HTTP_403_FORBIDDEN,
    ErrorCode.AI_DISABLED: status.HTTP_403_FORBIDDEN,
    ErrorCode.ANON_NOT_ALLOWED: status.HTTP_403_FORBIDDEN,
    ErrorCode.SESSION_NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.NOT_FOUND: status.HTTP_404_NOT_FOUND,
    ErrorCode.POLL_INVALID_STATE: status.HTTP_409_CONFLICT,
    ErrorCode.POLL_LOCKED: status.HTTP_409_CONFLICT,
    ErrorCode.ALREADY_RESPONDED: status.HTTP_409_CONFLICT,
    ErrorCode.QA_CLOSED: status.HTTP_409_CONFLICT,
    ErrorCode.SESSION_NOT_LIVE: status.HTTP_409_CONFLICT,
    ErrorCode.SESSION_ENDED: status.HTTP_410_GONE,
    ErrorCode.EXPORT_LINK_EXPIRED: status.HTTP_410_GONE,
    ErrorCode.PASSCODE_INVALID: status.HTTP_422_UNPROCESSABLE_ENTITY,
    ErrorCode.EMAIL_DOMAIN_RESTRICTED: status.HTTP_422_UNPROCESSABLE_ENTITY,
    ErrorCode.CONTENT_FILTERED: status.HTTP_422_UNPROCESSABLE_ENTITY,
    ErrorCode.RATE_LIMITED: status.HTTP_429_TOO_MANY_REQUESTS,
    ErrorCode.INTERNAL: status.HTTP_500_INTERNAL_SERVER_ERROR,
    ErrorCode.AI_UNAVAILABLE: status.HTTP_503_SERVICE_UNAVAILABLE,
}


class AppError(Exception):
    """應用層業務錯誤；攜帶錯誤碼與選填細節。"""

    def __init__(
        self,
        code: ErrorCode,
        message: str,
        *,
        details: dict[str, Any] | None = None,
        http_status: int | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.details = details or {}
        self.http_status = http_status or _DEFAULT_HTTP.get(
            code, status.HTTP_400_BAD_REQUEST
        )


def _render(request: Request, code: str, message: str, details: dict[str, Any]) -> dict[str, Any]:
    request_id = request.headers.get("x-request-id", "")
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id,
        }
    }


def register_error_handlers(app: FastAPI) -> None:
    """註冊統一錯誤信封處理器。"""

    @app.exception_handler(AppError)
    async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.http_status,
            content=_render(request, exc.code.value, exc.message, exc.details),
        )
