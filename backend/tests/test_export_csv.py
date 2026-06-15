"""匯出 CSV 欄位聯集單元測試。"""

from __future__ import annotations

import csv
import io

from app.services.export_service import _write_csv_bytes


def test_csv_export_mixed_row_keys() -> None:
    """participant / question 列含額外欄位時，CSV 不應因 DictWriter 拋錯。"""
    rows = [
        {"section": "session", "field": "title", "value": "測試活動"},
        {
            "section": "participant",
            "field": "display_name",
            "value": "匿名參與者",
            "email": None,
        },
        {
            "section": "question",
            "field": "text",
            "value": "請問…",
            "status": "approved",
            "upvotes": 3,
        },
    ]
    content = _write_csv_bytes(rows)
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    parsed = list(reader)
    assert len(parsed) == 3
    assert "email" in reader.fieldnames
    assert "status" in reader.fieldnames
    assert parsed[1]["section"] == "participant"
