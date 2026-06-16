"""S7-4/S7-5 Branding 與 Export 整合測試。"""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


class TestS74Branding:
    def test_get_and_update_branding(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        get_resp = client.get("/api/v1/admin/branding", headers=_headers(token))
        assert get_resp.status_code == 200, get_resp.text
        assert "branding" in get_resp.json()

        patch = client.patch(
            "/api/v1/admin/branding",
            headers=_headers(token),
            json={
                "primary_color": "#ff5500",
                "display_name": "測試品牌",
            },
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["branding"]["primary_color"] == "#ff5500"

    def test_public_branding_by_code(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        create = client.post(
            "/api/v1/sessions",
            headers=_headers(token),
            json={"title": "品牌測試活動"},
        )
        code = create.json()["code"]
        client.patch(
            "/api/v1/admin/branding",
            headers=_headers(token),
            json={"primary_color": "#112233", "display_name": "公開品牌"},
        )
        org = client.get("/api/v1/admin/organization", headers=_headers(token)).json()
        pub = client.get(f"/api/v1/branding/by-code/{code}")
        assert pub.status_code == 200, pub.text
        data = pub.json()
        assert data["primary_color"] == "#112233"
        assert data["display_name"] == org["name"]

    def test_public_branding_by_session(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        create = client.post(
            "/api/v1/sessions",
            headers=_headers(token),
            json={"title": "Screen 品牌測試"},
        )
        session_id = create.json()["id"]
        client.patch(
            "/api/v1/admin/branding",
            headers=_headers(token),
            json={"favicon_url": "https://example.com/favicon.ico"},
        )
        pub = client.get(f"/api/v1/branding/by-session/{session_id}")
        assert pub.status_code == 200, pub.text
        assert pub.json()["favicon_url"] == "https://example.com/favicon.ico"

    def test_site_branding_respects_override_flag(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        client.patch(
            "/api/v1/admin/branding",
            headers=_headers(token),
            json={
                "primary_color": "#ff5500",
                "override_theme_colors": True,
            },
        )
        site = client.get("/api/v1/branding/site")
        assert site.status_code == 200, site.text
        data = site.json()
        assert data["primary_color"] == "#ff5500"
        assert data["override_theme_colors"] is True

    def test_site_branding_public(self, client: TestClient) -> None:
        resp = client.get("/api/v1/branding/site")
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "primary_color" in data
        assert "display_name" in data
        assert "logo_url" in data

    def test_site_branding_prefers_configured_org(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        logo_url = "https://cdn.example.com/brand-logo.png"
        client.patch(
            "/api/v1/admin/branding",
            headers=_headers(token),
            json={"logo_url": logo_url, "display_name": "站點品牌"},
        )
        org = client.get("/api/v1/admin/organization", headers=_headers(token)).json()
        site = client.get("/api/v1/branding/site")
        assert site.status_code == 200, site.text
        data = site.json()
        assert data["logo_url"] == logo_url
        assert data["display_name"] == org["name"]


class TestS75Export:
    def test_create_and_download_export(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        token, _ = host_token
        create_sess = client.post(
            "/api/v1/sessions",
            headers=_headers(token),
            json={"title": "匯出測試"},
        )
        session_id = create_sess.json()["id"]

        export = client.post(
            "/api/v1/admin/exports",
            headers=_headers(token),
            json={"session_id": session_id, "format": "csv"},
        )
        assert export.status_code == 201, export.text
        job = export.json()
        assert job["status"] == "completed"
        assert job["download_url"] is not None

        dl = client.get(job["download_url"].replace("http://testserver", ""))
        assert dl.status_code == 200
        assert "text/csv" in dl.headers.get("content-type", "")

    def test_list_exports(self, client: TestClient, host_token: tuple[str, str]) -> None:
        token, _ = host_token
        resp = client.get("/api/v1/admin/exports", headers=_headers(token))
        assert resp.status_code == 200
        assert "items" in resp.json()
