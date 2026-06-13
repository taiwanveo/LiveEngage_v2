"""從請求取得用戶端 IP（支援反向代理 X-Forwarded-For）。"""

from __future__ import annotations

from fastapi import Request


def get_client_ip(request: Request) -> str:
    """回傳用戶端 IP；無法判斷時為 ``unknown``。"""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"
