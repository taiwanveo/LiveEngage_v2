"""相依注入骨架：伺服端權限強制（鐵律 8、SDS §5.2）。

完整 RBAC（JWT 解析、cohost_permissions JSONB 檢查）於任務 2 實作。
本回合提供 ``require_role`` 的介面骨架，確保權限一律在伺服端 dependency
層強制，前端僅做 UI 隱藏。
"""

from __future__ import annotations

from collections.abc import Callable

from app.models.enums import UserRole

# 角色高低排序（數字越大權限越高）
_ROLE_RANK: dict[UserRole, int] = {
    UserRole.GUEST: 0,
    UserRole.MEMBER: 1,
    UserRole.ADMIN: 2,
    UserRole.OWNER: 3,
}


def require_role(min_role: UserRole) -> Callable[..., None]:
    """產生一個 FastAPI 相依，要求呼叫者具備 ``min_role`` 以上角色。

    TODO（任務 2）：自 JWT 解析 actor、查 session 角色與 cohost 權限旗標，
    不足時丟 ``AppError(FORBIDDEN)``。目前為佔位骨架。
    """

    def _dependency() -> None:
        # TODO: 解析 token → 取得角色 → 比對 _ROLE_RANK[role] >= _ROLE_RANK[min_role]
        return None

    return _dependency
