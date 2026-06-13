"""健康檢查 smoke 測試。"""

from __future__ import annotations

from fastapi.testclient import TestClient


def test_scaffold_health_returns_ok(client: TestClient) -> None:
    """/health 應回 200 且 status=ok。（待對 AC：上線前對應 NFR 可用性）"""
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"


def test_scaffold_openapi_available(client: TestClient) -> None:
    """OpenAPI schema 應可取得（前端據此產 typed client）。"""
    resp = client.get("/openapi.json")
    assert resp.status_code == 200
    assert resp.json()["info"]["title"] == "LiveEngage API"
