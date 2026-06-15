"""Host 端角色權限（鐵律 8：伺服端強制）。"""

from __future__ import annotations

from app.core.errors import AppError, ErrorCode
from app.models.enums import UserRole
from app.models.user import User

# 可編輯／刪除 Poll、Quiz 等內容結構
_EDIT_ROLES = frozenset({UserRole.OWNER, UserRole.ADMIN, UserRole.HOST})

# 可現場控場（開始／停止／投影／審核等）
_CONTROL_ROLES = frozenset({UserRole.OWNER, UserRole.ADMIN, UserRole.HOST, UserRole.COHOST})


def normalize_role(role: UserRole | str) -> UserRole:
    """JWT／DB 相容：legacy ``member`` 視同 ``host``。"""
    if role == UserRole.MEMBER or role == "member":
        return UserRole.HOST
    return UserRole(role)


def can_edit_content(user: User) -> bool:
    return normalize_role(user.role) in _EDIT_ROLES


def can_control_session(user: User) -> bool:
    return normalize_role(user.role) in _CONTROL_ROLES


def assert_can_access_host(user: User) -> None:
    """訪客帳號不得進入控場 API。"""
    role = normalize_role(user.role)
    if role == UserRole.GUEST:
        raise AppError(ErrorCode.FORBIDDEN, "訪客帳號無法使用控場功能")


def assert_can_edit_content(user: User) -> None:
    assert_can_access_host(user)
    if not can_edit_content(user):
        raise AppError(ErrorCode.FORBIDDEN, "助理主持人無法編輯或刪除內容")


def assert_can_control(user: User) -> None:
    assert_can_access_host(user)
    if not can_control_session(user):
        raise AppError(ErrorCode.FORBIDDEN, "權限不足，無法執行控場操作")
