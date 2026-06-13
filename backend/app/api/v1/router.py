"""/api/v1 聚合路由。

本回合為空骨架；後續任務以 ``api_router.include_router(...)`` 掛載各資源
（sessions、questions、polls…）。
"""

from __future__ import annotations

from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1")
