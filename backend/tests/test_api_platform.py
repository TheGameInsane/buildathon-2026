"""API-level tests for platform-admin routes (spec section 10)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app
from tenancy.api_keys import create_api_key


def test_create_org_returns_a_working_api_key(admin_conn):
    raw_platform_key = create_api_key(admin_conn, org_id=None, label="platform")
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {raw_platform_key}"

    response = client.post(
        "/platform/orgs", json={"name": "New Co", "slug": "new-co", "admin_user_ref": "priya"}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["api_key"].startswith("sdr_")

    # the returned key actually works against an org-scoped route
    tenant_client = TestClient(app)
    tenant_client.headers["Authorization"] = f"Bearer {body['api_key']}"
    assert tenant_client.get("/campaigns").json() == []


def test_a_tenant_key_cannot_reach_platform_routes(two_orgs):
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"

    response = client.post(
        "/platform/orgs", json={"name": "X", "slug": "x", "admin_user_ref": "someone"}
    )
    assert response.status_code == 401
