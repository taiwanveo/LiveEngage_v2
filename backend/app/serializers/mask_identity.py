"""匿名遮蔽（鐵律 3、SDS §7.5）。

唯一允許實作身分遮蔽的地方。當記錄 ``is_anonymous=True`` 時，對外輸出
``display_name="Anonymous"``、``email=None``，且不洩漏 participant 對應。

僅 System Operator 稽核情境（獨立 API + 專屬權限 + audit log）可解析對應
（NFR-004），不走此函式。

完整型別化序列化（Pydantic schemas）於有對外端點時補上；本回合提供可單元
測試的核心遮蔽函式骨架。
"""

from __future__ import annotations

from typing import Any

ANONYMOUS_DISPLAY_NAME = "Anonymous"


def mask_identity(record: dict[str, Any]) -> dict[str, Any]:
    """回傳遮蔽後的淺拷貝；非破壞性。

    Args:
        record: 含 ``is_anonymous`` 與選填 ``display_name`` / ``email`` /
            ``participant_id`` 的輸出字典。

    Returns:
        遮蔽後的新字典；``is_anonymous`` 為真時抹除可識別欄位。
    """
    masked = dict(record)
    if masked.get("is_anonymous"):
        masked["display_name"] = ANONYMOUS_DISPLAY_NAME
        masked["email"] = None
        masked.pop("participant_id", None)
    return masked
