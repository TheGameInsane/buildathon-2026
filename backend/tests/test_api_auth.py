"""Self-serve registration and login (spec section 5's self-serve signup path),
through the real FastAPI app against a real Postgres.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def _register(**overrides) -> dict:
    body = {
        "company_name": "Acme Logistics",
        "admin_name": "Priya Sharma",
        "email": "priya@acmecorp.io",
        "password": "correct-horse-battery",
        **overrides,
    }
    return client.post("/auth/register", json=body)


def test_register_creates_a_working_org_and_key():
    response = _register()
    assert response.status_code == 201
    body = response.json()
    assert body["api_key"].startswith("sdr_")
    assert body["member"] == {"name": "Priya Sharma", "email": "priya@acmecorp.io", "role": "admin"}

    # the returned key actually works against an org-scoped route
    tenant_client = TestClient(app)
    tenant_client.headers["Authorization"] = f"Bearer {body['api_key']}"
    assert tenant_client.get("/campaigns").json() == []


def test_register_rejects_a_duplicate_email():
    _register(email="dupe@acmecorp.io")
    response = _register(company_name="A Different Co", email="dupe@acmecorp.io")
    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


def test_register_generates_a_unique_slug_on_collision():
    first = _register(company_name="Acme Co", email="one@acmecorp.io")
    second = _register(company_name="Acme Co", email="two@acmecorp.io")
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["org_id"] != second.json()["org_id"]


def test_register_rejects_a_short_password():
    response = _register(email="short@acmecorp.io", password="short")
    assert response.status_code == 422


def test_login_succeeds_with_correct_credentials_and_issues_a_working_key():
    _register(email="login-ok@acmecorp.io", password="correct-horse-battery")

    response = client.post(
        "/auth/login", json={"email": "login-ok@acmecorp.io", "password": "correct-horse-battery"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["member"]["role"] == "admin"

    tenant_client = TestClient(app)
    tenant_client.headers["Authorization"] = f"Bearer {body['api_key']}"
    assert tenant_client.get("/campaigns").json() == []


def test_login_rejects_wrong_password():
    _register(email="login-bad@acmecorp.io", password="correct-horse-battery")
    response = client.post(
        "/auth/login", json={"email": "login-bad@acmecorp.io", "password": "wrong-password"}
    )
    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


def test_login_rejects_unknown_email():
    response = client.post(
        "/auth/login", json={"email": "nobody@nowhere.io", "password": "whatever123"}
    )
    assert response.status_code == 401


def test_each_login_issues_a_distinct_key():
    _register(email="multi-login@acmecorp.io", password="correct-horse-battery")
    creds = {"email": "multi-login@acmecorp.io", "password": "correct-horse-battery"}

    first = client.post("/auth/login", json=creds).json()
    second = client.post("/auth/login", json=creds).json()
    assert first["api_key"] != second["api_key"]
