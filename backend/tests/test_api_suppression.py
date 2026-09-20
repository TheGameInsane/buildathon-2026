"""API-level tests for the suppression list CRUD (spec sections 7 and 10) — including
that adding an entry here is really what `orchestrator.policy_gate.check_gate`'s
do-not-contact check reads, and that suppression is isolated per org (spec: "org A's
suppression has no effect on org B")."""

from __future__ import annotations

from fastapi.testclient import TestClient

from db.connection import org_connection
from db.repository import OrgScopedRepo
from main import app
from orchestrator.policy_gate import Action, check_gate


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_create_list_and_delete_suppression_entry(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    assert client.get("/suppression").json() == []

    created = client.post(
        "/suppression", json={"email": "prospect@example.com", "reason": "unsubscribed"}
    )
    assert created.status_code == 201
    entry_id = created.json()["id"]

    listed = client.get("/suppression").json()
    assert len(listed) == 1 and listed[0]["email"] == "prospect@example.com"

    assert client.delete(f"/suppression/{entry_id}").status_code == 204
    assert client.get("/suppression").json() == []


def test_missing_identifier_is_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post("/suppression", json={"reason": "manual"})
    assert response.status_code == 400
    assert response.json()["code"] == "missing_identifier"


def test_suppression_added_via_api_blocks_the_real_gate_and_is_isolated_per_org(
    two_orgs, admin_conn
):
    org_a, org_b = two_orgs
    client_a, client_b = _client(org_a), _client(org_b)

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Q4 Outbound"})
        prospect = repo.insert(
            "prospects", {"full_name": "Jordan Lee", "email": "prospect@example.com"}
        )
        cp = repo.insert(
            "campaign_prospects", {"campaign_id": campaign["id"], "prospect_id": prospect["id"]}
        )
    admin_conn.execute("update campaigns set status = 'live' where id = %s", (campaign["id"],))

    client_a.post("/suppression", json={"email": "prospect@example.com", "reason": "manual"})

    with org_connection(org_a.id) as conn:
        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))
    assert result.allowed is False
    assert result.code == "suppressed"

    # org B never saw this write and has an empty suppression list of its own
    assert client_b.get("/suppression").json() == []
