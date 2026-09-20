"""API-level tests for org members CRUD (spec section 10) — including that
`password_hash` never leaks through any response and that members are isolated per org.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_create_list_update_and_delete_member(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    assert client.get("/org/members").json() == []

    created = client.post(
        "/org/members", json={"name": "Sam Rep", "email": "sam-crud@example.com", "role": "rep"}
    )
    assert created.status_code == 201
    body = created.json()
    assert body["role"] == "rep"
    assert "password_hash" not in body
    member_id = body["id"]

    listed = client.get("/org/members").json()
    assert len(listed) == 1 and listed[0]["email"] == "sam-crud@example.com"

    updated = client.patch(f"/org/members/{member_id}", json={"role": "manager"})
    assert updated.status_code == 200
    assert updated.json()["role"] == "manager"

    assert client.delete(f"/org/members/{member_id}").status_code == 204
    assert client.get("/org/members").json() == []


def test_invalid_role_is_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post(
        "/org/members",
        json={"name": "Sam", "email": "sam-invalid-role@example.com", "role": "owner"},
    )
    assert response.status_code == 400
    assert response.json()["code"] == "invalid_role"


def test_duplicate_email_is_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    client.post(
        "/org/members", json={"name": "Sam", "email": "sam-dup@example.com", "role": "rep"}
    )
    dup = client.post(
        "/org/members", json={"name": "Sam Two", "email": "sam-dup@example.com", "role": "viewer"}
    )
    assert dup.status_code == 409
    assert dup.json()["code"] == "email_taken"


def test_members_are_isolated_per_org(two_orgs):
    org_a, org_b = two_orgs
    client_a, client_b = _client(org_a), _client(org_b)

    member_id = client_a.post(
        "/org/members", json={"name": "Sam", "email": "isolated-sam@example.com", "role": "rep"}
    ).json()["id"]

    assert client_b.get("/org/members").json() == []
    assert client_b.patch(f"/org/members/{member_id}", json={"role": "admin"}).status_code == 404
    assert client_b.delete(f"/org/members/{member_id}").status_code == 404
