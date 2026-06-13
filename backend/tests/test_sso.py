"""SSO OIDC 登入流程測試。"""

from __future__ import annotations

import uuid
from urllib.parse import parse_qs, urlparse

import pytest
from app.core.config import get_settings
from fastapi.testclient import TestClient

from tests.helpers import seed_host_user


@pytest.fixture
def sso_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("LE_SSO_ENABLED", "true")
    monkeypatch.setenv("LE_SSO_TEST_MODE", "true")
    monkeypatch.setenv("LE_SSO_OIDC_ISSUER", "https://idp.test")
    monkeypatch.setenv("LE_SSO_OIDC_CLIENT_ID", "test-client")
    monkeypatch.setenv("LE_SSO_OIDC_CLIENT_SECRET", "test-secret")
    monkeypatch.setenv("LE_SSO_TEST_EMAIL", "sso-existing@example.com")
    monkeypatch.setenv("LE_API_PUBLIC_URL", "http://testserver")
    monkeypatch.setenv("LE_SSO_HOST_FRONTEND_URL", "http://host.test")
    get_settings.cache_clear()


def _ticket_from_redirect(location: str) -> str:
    fragment = location.split("#", 1)[-1]
    query = fragment.split("?", 1)[-1] if "?" in fragment else ""
    return parse_qs(query)["ticket"][0]


def test_sso_config_disabled(client: TestClient) -> None:
    resp = client.get("/api/v1/auth/sso/config")
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


def test_sso_login_flow_existing_user(
    client: TestClient, sso_env: None
) -> None:
    seed_host_user(email="sso-existing@example.com", password="TestPass123!")

    cfg = client.get("/api/v1/auth/sso/config")
    assert cfg.json()["enabled"] is True

    auth = client.get(
        "/api/v1/auth/sso/oidc/authorize?app=host",
        follow_redirects=False,
    )
    assert auth.status_code == 302
    parsed = urlparse(auth.headers["location"])
    state = parse_qs(parsed.query)["state"][0]

    callback = client.get(
        f"/api/v1/auth/sso/oidc/callback?code=test-code&state={state}",
        follow_redirects=False,
    )
    assert callback.status_code == 302
    ticket = _ticket_from_redirect(callback.headers["location"])

    exchange = client.post(
        "/api/v1/auth/sso/exchange",
        json={"ticket": ticket},
    )
    assert exchange.status_code == 200
    body = exchange.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_sso_auto_provision(
    client: TestClient, sso_env: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    email = f"sso-new-{uuid.uuid4().hex[:8]}@example.com"
    monkeypatch.setenv("LE_SSO_TEST_EMAIL", email)
    get_settings.cache_clear()

    auth = client.get(
        "/api/v1/auth/sso/oidc/authorize?app=host",
        follow_redirects=False,
    )
    state = parse_qs(urlparse(auth.headers["location"]).query)["state"][0]
    callback = client.get(
        f"/api/v1/auth/sso/oidc/callback?code=x&state={state}",
        follow_redirects=False,
    )
    ticket = _ticket_from_redirect(callback.headers["location"])
    exchange = client.post("/api/v1/auth/sso/exchange", json={"ticket": ticket})
    assert exchange.status_code == 200
