"""Rate limit 設定（存於 organizations.settings_jsonb.rate_limit）。"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class RateLimitSettings(BaseModel):
    """SDS §4.6 預設；可由 org settings 覆寫。"""

    question_per_min: int = Field(default=5, ge=1, le=120)
    upvote_per_min: int = Field(default=30, ge=1, le=600)
    poll_submit_per_min: int = Field(default=10, ge=1, le=120)
    passcode_per_min_per_ip: int = Field(default=5, ge=1, le=60)
    by_code_per_min_per_ip: int = Field(default=30, ge=1, le=300)


DEFAULT_RATE_LIMITS = RateLimitSettings()


def parse_rate_limits(settings_jsonb: dict[str, Any] | None) -> RateLimitSettings:
    """自 org settings_jsonb 解析 rate_limit 區塊。"""
    if not settings_jsonb:
        return DEFAULT_RATE_LIMITS
    raw = settings_jsonb.get("rate_limit")
    if not raw or not isinstance(raw, dict):
        return DEFAULT_RATE_LIMITS
    return RateLimitSettings.model_validate(raw)
