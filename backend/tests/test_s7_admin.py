"""S7-2/S7-3 Admin API 整合測試（BE-008/009/010）。

需要 LE_DATABASE_URL 環境變數（指向本機或 Neon Postgres）。
"""

from __future__ import annotations

import os
import uuid

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.skipif(
    not os.getenv("LE_DATABASE_URL"),
    reason="未設定 LE_DATABASE_URL，跳過整合測試",
)


# ── helpers ───────────────────────────────────────────────────────────────────

def _auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _login(client: TestClient, email: str, password: str) -> str:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


# ── BE-008 Organization ───────────────────────────────────────────────────────

class TestBE008Organization:
    def test_get_organization(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC1：取得組織資料需認證。"""
        token, _ = host_token
        resp = client.get("/api/v1/admin/organization", headers=_auth_headers(token))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "id" in data
        assert "name" in data
        assert "plan" in data

    def test_update_organization_name(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC2：更新組織名稱。"""
        token, _ = host_token
        new_name = f"更新組織-{uuid.uuid4().hex[:6]}"
        resp = client.patch(
            "/api/v1/admin/organization",
            headers=_auth_headers(token),
            json={"name": new_name},
        )
        assert resp.status_code == 200, resp.text
        assert resp.json()["name"] == new_name

    def test_get_organization_unauthenticated(self, client: TestClient) -> None:
        """BE-008-AC3：未認證存取回 401。"""
        resp = client.get("/api/v1/admin/organization")
        assert resp.status_code == 401


# ── BE-008 Members ────────────────────────────────────────────────────────────

class TestBE008Members:
    def test_list_members(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC4：列出成員。"""
        token, email = host_token
        resp = client.get("/api/v1/admin/members", headers=_auth_headers(token))
        assert resp.status_code == 200, resp.text
        members = resp.json()
        assert isinstance(members, list)
        emails = [m["email"] for m in members]
        assert email in emails

    def test_invite_and_remove_member(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC5：邀請新成員後列表數量增加，移除後恢復。"""
        token, _ = host_token
        new_email = f"member-{uuid.uuid4().hex[:8]}@example.com"

        invite_resp = client.post(
            "/api/v1/admin/members",
            headers=_auth_headers(token),
            json={
                "email": new_email,
                "name": "測試成員",
                "role": "member",
                "password": "TestPass123!",
            },
        )
        assert invite_resp.status_code == 201, invite_resp.text
        new_id = invite_resp.json()["id"]
        assert invite_resp.json()["email"] == new_email

        remove_resp = client.delete(
            f"/api/v1/admin/members/{new_id}",
            headers=_auth_headers(token),
        )
        assert remove_resp.status_code == 204, remove_resp.text

    def test_update_member_role(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC6：變更成員角色。"""
        token, _ = host_token
        new_email = f"role-{uuid.uuid4().hex[:8]}@example.com"

        invite = client.post(
            "/api/v1/admin/members",
            headers=_auth_headers(token),
            json={
                "email": new_email,
                "name": "角色測試",
                "role": "member",
                "password": "TestPass123!",
            },
        )
        assert invite.status_code == 201
        new_id = invite.json()["id"]

        patch_resp = client.patch(
            f"/api/v1/admin/members/{new_id}",
            headers=_auth_headers(token),
            json={"role": "admin"},
        )
        assert patch_resp.status_code == 200, patch_resp.text
        assert patch_resp.json()["role"] == "admin"

        client.delete(f"/api/v1/admin/members/{new_id}", headers=_auth_headers(token))

    def test_update_member_name_and_password(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        """BE-008-AC8：更新成員姓名與密碼。"""
        token, _ = host_token
        new_email = f"edit-{uuid.uuid4().hex[:8]}@example.com"

        invite = client.post(
            "/api/v1/admin/members",
            headers=_auth_headers(token),
            json={
                "email": new_email,
                "name": "原名",
                "role": "member",
                "password": "TestPass123!",
            },
        )
        assert invite.status_code == 201
        new_id = invite.json()["id"]

        patch_resp = client.patch(
            f"/api/v1/admin/members/{new_id}",
            headers=_auth_headers(token),
            json={"name": "新名稱", "password": "NewPass456!"},
        )
        assert patch_resp.status_code == 200, patch_resp.text
        assert patch_resp.json()["name"] == "新名稱"

        login = client.post(
            "/api/v1/auth/login",
            json={"email": new_email, "password": "NewPass456!"},
        )
        assert login.status_code == 200, login.text

        client.delete(f"/api/v1/admin/members/{new_id}", headers=_auth_headers(token))

    def test_update_member_name_and_password(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        """BE-008-AC8：更新成員姓名與密碼。"""
        token, _ = host_token
        new_email = f"edit-{uuid.uuid4().hex[:8]}@example.com"

        invite = client.post(
            "/api/v1/admin/members",
            headers=_auth_headers(token),
            json={
                "email": new_email,
                "name": "原名",
                "role": "member",
                "password": "TestPass123!",
            },
        )
        assert invite.status_code == 201
        new_id = invite.json()["id"]

        patch_resp = client.patch(
            f"/api/v1/admin/members/{new_id}",
            headers=_auth_headers(token),
            json={"name": "新名稱", "password": "NewPass456!"},
        )
        assert patch_resp.status_code == 200, patch_resp.text
        assert patch_resp.json()["name"] == "新名稱"

        login = client.post(
            "/api/v1/auth/login",
            json={"email": new_email, "password": "NewPass456!"},
        )
        assert login.status_code == 200, login.text

        client.delete(f"/api/v1/admin/members/{new_id}", headers=_auth_headers(token))

    def test_cannot_remove_self(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-008-AC7：不可移除自己。"""
        token, _ = host_token
        me = client.get("/api/v1/admin/members", headers=_auth_headers(token))
        my_id = me.json()[0]["id"]
        resp = client.delete(
            f"/api/v1/admin/members/{my_id}",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 403


# ── BE-009 Sessions ────────────────────────────────────────────────────────────

class TestBE009Sessions:
    def test_list_sessions(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-009-AC1：列出組織活動。"""
        token, _ = host_token
        client.post(
            "/api/v1/sessions",
            headers=_auth_headers(token),
            json={"title": "Admin 測試活動"},
        )
        resp = client.get("/api/v1/admin/sessions", headers=_auth_headers(token))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_list_sessions_filter_by_status(
        self, client: TestClient, host_token: tuple[str, str]
    ) -> None:
        """BE-009-AC2：以 status 篩選活動列表。"""
        token, _ = host_token
        resp = client.get(
            "/api/v1/admin/sessions?status=draft",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        for s in resp.json()["items"]:
            assert s["status"] == "draft"

    def test_archive_session(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-009-AC3：封存活動。"""
        token, _ = host_token
        create = client.post(
            "/api/v1/sessions",
            headers=_auth_headers(token),
            json={"title": "待封存活動"},
        )
        session_id = create.json()["id"]

        archive = client.patch(
            f"/api/v1/admin/sessions/{session_id}",
            headers=_auth_headers(token),
            json={"status": "archived"},
        )
        assert archive.status_code == 200, archive.text
        assert archive.json()["status"] == "archived"
        assert archive.json()["archived_at"] is not None

    def test_list_sessions_search(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-009-AC4：搜尋活動標題。"""
        token, _ = host_token
        unique_title = f"UniqueTitle-{uuid.uuid4().hex[:8]}"
        client.post(
            "/api/v1/sessions",
            headers=_auth_headers(token),
            json={"title": unique_title},
        )
        resp = client.get(
            f"/api/v1/admin/sessions?search={unique_title[:10]}",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        assert any(s["title"] == unique_title for s in resp.json()["items"])


# ── BE-010 Audit Logs ──────────────────────────────────────────────────────────

class TestBE010AuditLogs:
    def test_list_audit_logs(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-010-AC1：查詢稽核紀錄（先觸發一筆）。"""
        token, _ = host_token
        client.patch(
            "/api/v1/admin/organization",
            headers=_auth_headers(token),
            json={"name": f"Audit-{uuid.uuid4().hex[:6]}"},
        )
        resp = client.get("/api/v1/admin/audit-logs", headers=_auth_headers(token))
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "items" in data
        assert "total" in data
        assert data["total"] >= 1

    def test_audit_log_fields(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-010-AC2：紀錄包含必要欄位。"""
        token, _ = host_token
        resp = client.get(
            "/api/v1/admin/audit-logs?action=update_organization",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        if items:
            item = items[0]
            assert "id" in item
            assert "action" in item
            assert "created_at" in item
            assert "actor_user_id" in item

    def test_audit_log_filter_by_action(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-010-AC3：以 action 篩選。"""
        token, _ = host_token
        resp = client.get(
            "/api/v1/admin/audit-logs?action=nonexistent_action_xyz",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 0

    def test_audit_log_pagination(self, client: TestClient, host_token: tuple[str, str]) -> None:
        """BE-010-AC4：分頁參數正常回傳。"""
        token, _ = host_token
        resp = client.get(
            "/api/v1/admin/audit-logs?page=1&page_size=5",
            headers=_auth_headers(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["page"] == 1
        assert data["page_size"] == 5
        assert len(data["items"]) <= 5
