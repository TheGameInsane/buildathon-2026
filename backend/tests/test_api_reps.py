"""API-level tests for reps CRUD, offboarding and campaign assignment (spec sections
5, 7 and 10) — including that tenant isolation holds (org B can't see or touch org A's
reps or assignments)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_create_list_and_update_rep(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    assert client.get("/reps").json() == []  # empty state is [], not an error

    created = client.post(
        "/reps",
        json={
            "name": "Jordan Lee",
            "email": "jordan@example.com",
            "timezone": "America/New_York",
            "work_start": "09:00",
            "work_end": "17:00",
            "work_days": [1, 2, 3, 4, 5],
            "daily_caps": {"email": 30},
        },
    )
    assert created.status_code == 201
    rep_id = created.json()["id"]
    assert created.json()["work_start"] == "09:00"
    assert created.json()["status"] == "active"
    assert created.json()["assignments"] == []

    listed = client.get("/reps").json()
    assert len(listed) == 1
    assert listed[0]["id"] == rep_id

    updated = client.patch(f"/reps/{rep_id}", json={"signature": "Best, Jordan"})
    assert updated.status_code == 200
    assert updated.json()["signature"] == "Best, Jordan"


def test_reps_are_isolated_per_org(two_orgs):
    org_a, org_b = two_orgs
    client_a, client_b = _client(org_a), _client(org_b)

    rep_id = client_a.post("/reps", json={"name": "Only in A"}).json()["id"]

    assert client_b.get("/reps").json() == []
    assert client_b.patch(f"/reps/{rep_id}", json={"name": "hijacked"}).status_code == 404
    assert client_b.get(f"/reps/{rep_id}/assignments").status_code == 404


def test_assign_and_unassign_rep_to_campaign(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    rep_id = client.post("/reps", json={"name": "Jordan Lee"}).json()["id"]
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    assign = client.post(f"/campaigns/{campaign_id}/reps", json={"rep_id": rep_id})
    assert assign.status_code == 201

    rep = client.get("/reps").json()[0]
    assert rep["assignments"] == [
        {"campaign_id": campaign_id, "campaign_name": "Q4 Outbound", "use_rep_identity": True}
    ]

    assignments = client.get(f"/reps/{rep_id}/assignments").json()
    assert len(assignments) == 1 and assignments[0]["campaign_id"] == campaign_id

    unassign = client.delete(f"/campaigns/{campaign_id}/reps/{rep_id}")
    assert unassign.status_code == 204
    assert client.get(f"/reps/{rep_id}/assignments").json() == []

    # unassigning again is a 404, not a silent success
    assert client.delete(f"/campaigns/{campaign_id}/reps/{rep_id}").status_code == 404


def test_offboard_reassigns_affected_campaigns_and_marks_status(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    leaving = client.post("/reps", json={"name": "Leaving Rep"}).json()["id"]
    replacement = client.post("/reps", json={"name": "Replacement Rep"}).json()["id"]
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]
    client.post(f"/campaigns/{campaign_id}/reps", json={"rep_id": leaving})

    result = client.post(
        f"/reps/{leaving}/offboard",
        json={"reassignments": [{"campaign_id": campaign_id, "new_rep_id": replacement}]},
    )
    assert result.status_code == 200
    body = result.json()
    assert body["rep"]["status"] == "offboarded"
    assert body["affected_campaigns"] == [
        {"campaign_id": campaign_id, "campaign_name": "Q4 Outbound", "use_rep_identity": True}
    ]

    assert client.get(f"/reps/{leaving}/assignments").json() == []
    assignments = client.get(f"/reps/{replacement}/assignments").json()
    assert len(assignments) == 1 and assignments[0]["campaign_id"] == campaign_id


def test_reassign_endpoint_moves_a_single_campaign(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    rep_a = client.post("/reps", json={"name": "Rep A"}).json()["id"]
    rep_b = client.post("/reps", json={"name": "Rep B"}).json()["id"]
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]
    client.post(f"/campaigns/{campaign_id}/reps", json={"rep_id": rep_a})

    response = client.post(
        "/reps/reassign",
        json={"campaign_id": campaign_id, "from_rep_id": rep_a, "to_rep_id": rep_b},
    )
    assert response.status_code == 204
    assert client.get(f"/reps/{rep_a}/assignments").json() == []
    assert len(client.get(f"/reps/{rep_b}/assignments").json()) == 1
