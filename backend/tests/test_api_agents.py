"""API-level tests for per-campaign agent config and stats (spec section 10:
`GET/PATCH /campaigns/{id}/agents*`)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_list_agents_defaults_to_active_with_no_runs_yet(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    response = client.get(f"/campaigns/{campaign_id}/agents")
    assert response.status_code == 200
    agents = response.json()
    assert {a["agent"] for a in agents} == {
        "research", "fitment", "strategy", "personalisation", "conversation", "follow_up",
    }
    for agent in agents:
        assert agent["enabled"] is True
        assert agent["paused"] is False
        assert agent["active_version"] == 0
        assert agent["runs_today"] == 0
        assert agent["last_run_at"] is None


def test_pause_and_unpause_an_agent(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    paused = client.patch(f"/campaigns/{campaign_id}/agents/strategy", json={"paused": True})
    assert paused.status_code == 200
    assert paused.json()["paused"] is True

    # sticks on a fresh list, not just the PATCH response
    agents = client.get(f"/campaigns/{campaign_id}/agents").json()
    strategy = next(a for a in agents if a["agent"] == "strategy")
    assert strategy["paused"] is True
    others = [a for a in agents if a["agent"] != "strategy"]
    assert all(a["paused"] is False for a in others)

    unpaused = client.patch(f"/campaigns/{campaign_id}/agents/strategy", json={"paused": False})
    assert unpaused.json()["paused"] is False


def test_active_version_reflects_prompt_studio(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    client.post(
        f"/campaigns/{campaign_id}/prompts/research/versions",
        json={"content": "Custom research prompt", "author": "Jordan", "changelog": "v1"},
    )

    agents = client.get(f"/campaigns/{campaign_id}/agents").json()
    research = next(a for a in agents if a["agent"] == "research")
    assert research["active_version"] == 1


def test_agents_are_isolated_per_org(two_orgs):
    org_a, org_b = two_orgs
    client_a, client_b = _client(org_a), _client(org_b)
    campaign_id = client_a.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    assert client_b.get(f"/campaigns/{campaign_id}/agents").status_code == 404
    assert client_b.patch(
        f"/campaigns/{campaign_id}/agents/strategy", json={"paused": True}
    ).status_code == 404
