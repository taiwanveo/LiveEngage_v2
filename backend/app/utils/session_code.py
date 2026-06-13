"""活動代碼產生（SDS §8：6–8 碼、排除易混淆字元、CSPRNG）。"""

from __future__ import annotations

import secrets

# 排除 0/O、1/I/l 等易混淆字元
_SESSION_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


def generate_session_code(length: int = 6) -> str:
    """產生隨機活動代碼。"""
    if length < 6 or length > 8:
        msg = "session code length must be 6–8"
        raise ValueError(msg)
    return "".join(secrets.choice(_SESSION_CODE_ALPHABET) for _ in range(length))
