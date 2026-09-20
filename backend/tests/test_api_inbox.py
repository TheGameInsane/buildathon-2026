"""API-level tests for the inbox/approvals flow (spec section 10)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from db.connection import org_connection
from db.repository import OrgScopedRepo
from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_pending_approval_appears_in_inbox_and_can_be_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Q4 Outbound"})
        approval = repo.insert(
            "approvals", {"campaign_id": campaign["id"], "reason": "review", "status": "pending"}
        )

    inbox = client.get("/inbox").json()
    assert len(inbox) == 1
    assert inbox[0]["id"] == str(approval["id"])
    assert inbox[0]["kind"] == "approval"

    rejected = client.post(f"/approvals/{approval['id']}/reject")
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"

    assert client.get("/inbox").json() == []  # no longer pending


def test_approving_twice_is_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Q4 Outbound"})
        approval = repo.insert(
            "approvals", {"campaign_id": campaign["id"], "reason": "review", "status": "pending"}
        )

    first = client.post(f"/approvals/{approval['id']}/approve")
    assert first.status_code == 200

    second = client.post(f"/approvals/{approval['id']}/approve")
    assert second.status_code == 409
    assert second.json()["code"] == "not_pending"


def test_inbox_is_isolated_per_org(two_orgs):
    org_a, org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Org A's campaign"})
        approval_data = {"campaign_id": campaign["id"], "reason": "review", "status": "pending"}
        repo.insert("approvals", approval_data)

    assert len(_client(org_a).get("/inbox").json()) == 1
    assert _client(org_b).get("/inbox").json() == []
