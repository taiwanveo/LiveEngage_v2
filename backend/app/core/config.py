"""應用設定。

以 pydantic-settings 由環境變數載入；前綴 ``LE_``。
機密欄位（JWT secret、DB 密碼）僅由環境提供，不寫入版控（鐵律 9）。
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """全域設定單例。"""

    model_config = SettingsConfigDict(
        env_prefix="LE_",
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 應用
    env: str = "dev"
    debug: bool = False
    log_level: str = "INFO"

    # 資料庫
    database_url: str = (
        "postgresql+asyncpg://liveengage:liveengage@localhost:5432/liveengage"
    )
    database_url_sync: str = (
        "postgresql+psycopg://liveengage:liveengage@localhost:5432/liveengage"
    )

    # Redis（任務 2+ 使用）
    redis_url: str = "redis://localhost:6379/0"

    # JWT（骨架；完整簽發於任務 2）
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_ttl_minutes: int = 15
    jwt_refresh_ttl_days: int = 14


@lru_cache
def get_settings() -> Settings:
    """回傳快取後的設定單例。"""
    return Settings()
