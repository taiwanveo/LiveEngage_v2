"""匯出簽名連結（BE-012，72h 有效）。"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import secrets
import uuid

from app.core.config import get_settings


def _secret() -> bytes:
    return get_settings().jwt_secret.encode()


def create_download_token() -> str:
    """產生隨機 download token（存 DB）。"""
    return secrets.token_urlsafe(32)


def _naive_utc(value: dt.datetime) -> dt.datetime:
    """統一為 naive UTC（對齊 DB TIMESTAMP WITHOUT TIME ZONE 讀寫）。"""
    if value.tzinfo is not None:
        return value.astimezone(dt.UTC).replace(tzinfo=None)
    return value


def sign_download(job_id: uuid.UUID, token: str, expires_at: dt.datetime) -> str:
    """產生 HMAC 簽名（用於 download URL query param）。"""
    exp = _naive_utc(expires_at)
    payload = f"{job_id}:{token}:{int(exp.timestamp())}"
    return hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()


def verify_download(
    job_id: uuid.UUID,
    token: str,
    expires_at: dt.datetime,
    signature: str,
) -> bool:
    """驗證簽名與有效期。"""
    exp = _naive_utc(expires_at)
    if dt.datetime.utcnow() > exp:
        return False
    expected = sign_download(job_id, token, exp)
    return hmac.compare_digest(expected, signature)
