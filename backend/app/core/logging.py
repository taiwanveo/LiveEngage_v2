"""結構化 JSON 日誌與機密遮蔽 filter（鐵律 9）。

任何 JWT、passcode、密碼、SSO token 等機密不得進 log；
此處以 filter 對訊息做關鍵字遮蔽，作為最後防線。
"""

from __future__ import annotations

import logging
import re

_SECRET_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"(?i)(authorization|bearer)\s+[\w.\-]+"),
    re.compile(r"(?i)(passcode|password|secret|token|jwt)\s*[=:]\s*\S+"),
]
_REDACTED = "***REDACTED***"


class SecretRedactionFilter(logging.Filter):
    """將訊息中的機密樣式替換為遮蔽字串。"""

    def filter(self, record: logging.LogRecord) -> bool:
        message = record.getMessage()
        for pattern in _SECRET_PATTERNS:
            message = pattern.sub(_REDACTED, message)
        record.msg = message
        record.args = ()
        return True


def configure_logging(level: str = "INFO") -> None:
    """設定根 logger 為結構化輸出並掛上遮蔽 filter。

    若安裝 python-json-logger 則輸出 JSON；否則退回純文字格式。
    """
    handler = logging.StreamHandler()
    handler.addFilter(SecretRedactionFilter())

    try:
        from pythonjsonlogger import jsonlogger

        formatter: logging.Formatter = jsonlogger.JsonFormatter(  # type: ignore[attr-defined]
            "%(asctime)s %(levelname)s %(name)s %(message)s"
        )
    except ImportError:  # pragma: no cover - 後備格式
        formatter = logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s"
        )

    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())
