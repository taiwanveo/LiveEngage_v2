"""/api/v1 聚合路由。

後續任務以 ``api_router.include_router(...)`` 掛載各資源（sessions、
questions、interactions、polls…）。
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import (
    admin,
    ai,
    auth,
    branding,
    cohosts,
    exports,
    ideas,
    interactions,
    polls,
    questions,
    quizzes,
    sessions,
    surveys,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router)
api_router.include_router(sessions.router)
api_router.include_router(interactions.router)
api_router.include_router(questions.router)
api_router.include_router(polls.router)
api_router.include_router(quizzes.router)
api_router.include_router(ideas.router)
api_router.include_router(cohosts.router)
api_router.include_router(surveys.router)
api_router.include_router(ai.router)
api_router.include_router(admin.router)
api_router.include_router(exports.router)
api_router.include_router(branding.router)
