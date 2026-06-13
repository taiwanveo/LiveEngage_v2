"""UUID v7 產生器（鐵律 7：ID 用 UUID v7，時間有序、對外不可枚舉）。

Python 3.14 起 stdlib 內建 ``uuid.uuid7``；3.12 / 3.13 無此函式，
此處依 RFC 9562 §5.7 自行實作為後備，確保跨版本行為一致。
"""

from __future__ import annotations

import os
import time
import uuid

_HAS_STDLIB_UUID7 = hasattr(uuid, "uuid7")


def _uuid7_fallback() -> uuid.UUID:
    """RFC 9562 UUID v7：48-bit 毫秒時間戳 + 隨機位元。"""
    unix_ms = time.time_ns() // 1_000_000
    rand = os.urandom(10)
    rand_int = int.from_bytes(rand, "big")

    # 128 位元組裝：time(48) | ver(4)=0b0111 | rand_a(12) | var(2)=0b10 | rand_b(62)
    value = (unix_ms & 0xFFFF_FFFF_FFFF) << 80
    value |= 0x7 << 76
    value |= ((rand_int >> 64) & 0x0FFF) << 64
    value |= 0b10 << 62
    value |= rand_int & 0x3FFF_FFFF_FFFF_FFFF
    return uuid.UUID(int=value)


def uuid7() -> uuid.UUID:
    """回傳一個 UUID v7。"""
    if _HAS_STDLIB_UUID7:
        return uuid.uuid7()
    return _uuid7_fallback()
