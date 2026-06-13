"""應用設定。

以 pydantic-settings 由環境變數載入；前綴 ``LE_``。
機密欄位（JWT secret、DB 密碼）僅由環境提供，不寫入版控（鐵律 9）。

若僅設定 ``LE_DATABASE_URL_SYNC``（未設 ``LE_DATABASE_URL``），會自動由 sync URL
推導 async URL（``psycopg→asyncpg``、``sslmode→ssl``），避免重複寫密碼。
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Self

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py → 專案根目錄（LiveEngage/.env）
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_BACKEND_ROOT = Path(__file__).resolve().parents[2]

# 本地 .env 優先於 shell 殘留 LE_*（部署環境無 .env，仍用平台 env）
_env_file = _PROJECT_ROOT / ".env"
if _env_file.is_file():
    load_dotenv(_env_file, override=True)

# pydantic 預設值；用於判斷使用者是否「只設了 sync、沒設 async」
_DEFAULT_ASYNC_URL = (
    "postgresql+asyncpg://liveengage:liveengage@localhost:5432/liveengage?ssl=require"
)
_DEFAULT_SYNC_URL = (
    "postgresql+psycopg://liveengage:liveengage@localhost:5432/liveengage"
)


def sync_to_async_url(sync_url: str) -> str:
    """將 sync DSN 轉為 asyncpg 可用的 async DSN。"""
    url = sync_url
    if url.startswith("postgresql+psycopg://"):
        url = url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    url = url.replace("sslmode=require", "ssl=require")
    url = url.replace("sslmode=prefer", "ssl=prefer")
    url = url.replace("sslmode=disable", "ssl=disable")
    return url


class Settings(BaseSettings):
    """全域設定單例。"""

    model_config = SettingsConfigDict(
        env_prefix="LE_",
        env_file=(
            str(_PROJECT_ROOT / ".env"),
            str(_BACKEND_ROOT / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 應用
    env: str = "dev"
    debug: bool = False
    log_level: str = "INFO"

    # 資料庫
    database_url: str = _DEFAULT_ASYNC_URL
    database_url_sync: str = _DEFAULT_SYNC_URL

    # Redis（任務 2+ 使用）
    redis_url: str = "redis://localhost:6379/0"

    # Celery（匯出 Worker；broker 預設與 redis_url 相同）
    celery_broker_url: str = ""
    celery_task_always_eager: bool = False

    # AI 旁路（未設定時回 503 AI_UNAVAILABLE）
    ai_api_key: str = ""
    ai_enabled: bool = False

    # SSO / OIDC（Host / Admin 登入）
    sso_enabled: bool = False
    sso_test_mode: bool = False
    sso_test_email: str = ""
    sso_oidc_issuer: str = ""
    sso_oidc_client_id: str = ""
    sso_oidc_client_secret: str = ""
    sso_oidc_scopes: str = "openid email profile"
    sso_button_label: str = "使用 SSO 登入"
    sso_auto_provision: bool = True
    sso_default_org_id: str = ""
    api_public_url: str = "http://localhost:8000"
    sso_host_frontend_url: str = "http://localhost:5173"
    sso_admin_frontend_url: str = "http://localhost:5176"
    sso_participant_frontend_url: str = "http://localhost:5174"

    # AI（OpenAI-compatible）
    ai_model: str = "gpt-4o-mini"
    ai_base_url: str = "https://api.openai.com/v1"

    # JWT（骨架；完整簽發於任務 2）
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 15
    jwt_refresh_ttl_days: int = 14

    # CORS（生產環境跨域前端；逗號分隔，或 `*` 搭配 regex）
    cors_origins: str = ""
    cors_origin_regex: str = ""

    @model_validator(mode="after")
    def derive_async_database_url(self) -> Self:
        """僅設 sync 時，由 sync 推導 async（不必重複密碼）。"""
        if (
            self.database_url == _DEFAULT_ASYNC_URL
            and self.database_url_sync != _DEFAULT_SYNC_URL
        ):
            self.database_url = sync_to_async_url(self.database_url_sync)
        if not self.celery_broker_url:
            self.celery_broker_url = self.redis_url
        return self


@lru_cache
def get_settings() -> Settings:
    """回傳快取後的設定單例。"""
    return Settings()
