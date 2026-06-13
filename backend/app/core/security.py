"""安全工具骨架（SDS §8、鐵律 9）。

- 密碼 / passcode 以 argon2id 雜湊。
- JWT 簽發 / 驗證留待任務 2 完整實作。
本回合僅提供雜湊封裝，verify 已可用以利後續測試。
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_hasher = PasswordHasher()


def hash_secret(raw: str) -> str:
    """以 argon2id 雜湊密碼或 passcode。"""
    return _hasher.hash(raw)


def verify_secret(hashed: str, raw: str) -> bool:
    """驗證明文是否符合雜湊；不丟例外，回傳布林。"""
    try:
        return _hasher.verify(hashed, raw)
    except VerifyMismatchError:
        return False
