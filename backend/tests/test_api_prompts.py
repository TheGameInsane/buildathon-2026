"""API-level tests for prompt versioning (spec section 12.4) — proving Prompt Studio's
routes, tenant isolation, and that activating a version is really what
`orchestrator.prompts.active_prompt` (what `orchestrator/step.py` calls) returns next.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from db.connection import org_connection
from main import app
from orchestrator.prompts import active_prompt


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def _campaign_id(client: TestClient) -> str:
    return client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]


def test_no_versions_yet_reports_the_shipped_default(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = _campaign_id(client)

    summary = client.get(f"/campaigns/{campaign_id}/prompts").json()
    strategy_entry = next(e for e in summary if e["agent"] == "strategy")
    assert strategy_entry["version"]["version"] == 0
    assert strategy_entry["version"]["active"] is True
    assert strategy_entry["version"]["content"]  # the real shipped template, not empty

    versions = client.get(f"/campaigns/{campaign_id}/prompts/strategy/versions").json()
    assert len(versions) == 1
    assert versions[0]["version"] == 0


def test_first_draft_is_activated_automatically(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = _campaign_id(client)

    response = client.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "v1 body", "author": "Priya", "changelog": "Initial version"},
    )
    assert response.status_code == 201
    draft = response.json()
    assert draft["version"] == 1
    assert draft["active"] is True

    with org_connection(org_a.id) as conn:
        body, version_id = active_prompt(conn, org_a.id, campaign_id, "strategy")
    assert body == "v1 body"
    assert version_id is not None


def test_activate_and_roll_back(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = _campaign_id(client)

    client.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "v1", "author": "Priya", "changelog": "v1"},
    )
    client.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "v2", "author": "Priya", "changelog": "v2"},
    )

    with org_connection(org_a.id) as conn:
        body, _ = active_prompt(conn, org_a.id, campaign_id, "strategy")
    assert body == "v1"  # v2 was only saved as a draft, not yet activated

    activate = client.post(f"/campaigns/{campaign_id}/prompts/strategy/versions/2/activate")
    assert activate.status_code == 204
    with org_connection(org_a.id) as conn:
        body, _ = active_prompt(conn, org_a.id, campaign_id, "strategy")
    assert body == "v2"

    # Roll back is the same endpoint, an older version number.
    client.post(f"/campaigns/{campaign_id}/prompts/strategy/versions/1/activate")
    with org_connection(org_a.id) as conn:
        body, _ = active_prompt(conn, org_a.id, campaign_id, "strategy")
    assert body == "v1"


def test_activating_one_agent_never_touches_another(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = _campaign_id(client)

    client.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "strategy v1", "author": "Priya", "changelog": "v1"},
    )
    client.post(
        f"/campaigns/{campaign_id}/prompts/research/versions",
        json={"content": "research v1", "author": "Priya", "changelog": "v1"},
    )

    with org_connection(org_a.id) as conn:
        strategy_body, _ = active_prompt(conn, org_a.id, campaign_id, "strategy")
        research_body, _ = active_prompt(conn, org_a.id, campaign_id, "research")
    assert strategy_body == "strategy v1"
    assert research_body == "research v1"


def test_activate_unknown_version_404s(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = _campaign_id(client)

    response = client.post(f"/campaigns/{campaign_id}/prompts/strategy/versions/9/activate")
    assert response.status_code == 404


def test_org_b_cannot_read_org_as_prompts(two_orgs):
    org_a, org_b = two_orgs
    client_a = _client(org_a)
    client_b = _client(org_b)
    campaign_id = _campaign_id(client_a)
    client_a.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "secret prompt", "author": "Priya", "changelog": "v1"},
    )

    response = client_b.get(f"/campaigns/{campaign_id}/prompts/strategy/versions")
    assert response.status_code == 404
