"""Idempotency-Key 去重（鐵律 4；Redis SETNX，TTL 24h）。"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterable, Awaitable, Callable
from typing import cast

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

HEADER = "Idempotency-Key"
TTL_SECONDS = 86400
_WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _cache_key(idempotency_key: str) -> str:
    return f"idempotency:{idempotency_key}"


async def _read_response_body(response: Response) -> bytes:
    iterator = getattr(response, "body_iterator", None)
    if iterator is not None:
        return b"".join([chunk async for chunk in cast(AsyncIterable[bytes], iterator)])
    body = response.body
    return bytes(body) if isinstance(body, memoryview) else body


async def reserve_idempotency_key(key: str) -> tuple[bool, dict[str, object] | None]:
    """嘗試保留 key。回傳 (is_new, cached_response_dict)。"""
    redis = await get_redis()
    if redis is None:
        return True, None

    cache_key = _cache_key(key)
    cached = await redis.get(cache_key)
    if cached:
        if cached == "pending":
            pending_body = {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "請求處理中",
                    "details": {},
                    "request_id": "",
                }
            }
            return False, {"status": 409, "body": pending_body}
        try:
            return False, json.loads(cached)
        except json.JSONDecodeError:
            return True, None

    reserved = await redis.set(cache_key, "pending", nx=True, ex=TTL_SECONDS)
    return (True, None) if reserved else (False, None)


async def store_idempotency_result(key: str, status: int, body: object) -> None:
    redis = await get_redis()
    if redis is None:
        return
    payload = json.dumps({"status": status, "body": body}, default=str)
    await redis.set(_cache_key(key), payload, ex=TTL_SECONDS)


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """對 /api/v1 寫入端點支援 Idempotency-Key header。"""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if (
            request.method not in _WRITE_METHODS
            or not request.url.path.startswith("/api/v1")
        ):
            return await call_next(request)

        key = request.headers.get(HEADER)
        if not key:
            return await call_next(request)

        is_new, cached = await reserve_idempotency_key(key)
        if not is_new and cached is not None:
            raw_status = cached.get("status")
            status = raw_status if isinstance(raw_status, int) else 200
            body = cached.get("body", {})
            return JSONResponse(status_code=status, content=body)

        response = await call_next(request)

        if response.status_code < 500:
            try:
                body_bytes = await _read_response_body(response)
                body = json.loads(body_bytes.decode()) if body_bytes else {}
                await store_idempotency_result(key, response.status_code, body)
                return JSONResponse(
                    status_code=response.status_code,
                    content=body,
                    headers={
                        k: v
                        for k, v in response.headers.items()
                        if k.lower() not in ("content-length", "transfer-encoding")
                    },
                )
            except Exception:
                logger.warning("Idempotency 結果快取失敗", exc_info=True)

        return response
