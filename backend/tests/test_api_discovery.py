"""DronaHQ discovery import behavior, including deduplication on a repeat run."""

import pytest
from fastapi.testclient import TestClient

from api import dronahq_discovery, prospects
from main import app


def test_discovery_imports_normalised_agent_results_and_is_idempotent(two_orgs, monkeypatch):
    # A real webhook URL has to be configured for the route to call it at all -
    # otherwise it goes straight to the simulated (docs/prospects.json) fallback,
    # covered separately below.
    monkeypatch.setenv("DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL", "https://example.test/webhook")
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"
    campaign_id = client.post("/campaigns", json={"name": "SaaS ICP"}).json()["id"]
    agent_response = {
        "results": [
            {
                "name": "Avery Chen",
                "email_address": "avery@example.test",
                "company_name": "Acme",
                "job_title": "CTO",
            },
            {
                "first_name": "Mina",
                "last_name": "Patel",
                "work_email": "mina@example.test",
                "organization": "Northstar",
            },
            {},
        ]
    }
    monkeypatch.setattr(prospects, "invoke_discovery", lambda payload: agent_response)

    first = client.post(f"/campaigns/{campaign_id}/prospects/discover")
    assert first.status_code == 200
    assert first.json()["imported"] == 2
    assert first.json()["skipped"] == 1
    assert first.json()["prospects"][0]["full_name"] == "Avery Chen"
    assert first.json()["prospects"][0]["role"] == "CTO"

    second = client.post(f"/campaigns/{campaign_id}/prospects/discover")
    assert second.status_code == 200
    assert second.json()["imported"] == 0
    assert second.json()["skipped"] == 3
    assert len(client.get(f"/campaigns/{campaign_id}/prospects").json()) == 2


def test_bulk_import_dedupes_by_email_same_as_discovery(two_orgs):
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"
    campaign_id = client.post("/campaigns", json={"name": "SaaS ICP"}).json()["id"]

    rows = [
        {
            "full_name": "Avery Chen", "email": "avery@example.test",
            "company": "Acme", "role": "CTO",
        },  # fmt: skip
        {"full_name": "Mina Patel", "email": "mina@example.test", "company": "Northstar"},
        {},  # a blank CSV row is skipped, not stored as an empty prospect
    ]

    first = client.post(f"/campaigns/{campaign_id}/prospects/import", json=rows)
    assert first.status_code == 200
    assert first.json()["imported"] == 2
    assert first.json()["skipped"] == 1
    assert len(client.get(f"/campaigns/{campaign_id}/prospects").json()) == 2

    # re-importing the same file is a no-op, same idempotency as discovery
    second = client.post(f"/campaigns/{campaign_id}/prospects/import", json=rows)
    assert second.status_code == 200
    assert second.json()["imported"] == 0
    assert second.json()["skipped"] == 3
    assert len(client.get(f"/campaigns/{campaign_id}/prospects").json()) == 2


def test_bulk_import_empty_list_is_a_noop(two_orgs):
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"
    campaign_id = client.post("/campaigns", json={"name": "SaaS ICP"}).json()["id"]

    response = client.post(f"/campaigns/{campaign_id}/prospects/import", json=[])
    assert response.status_code == 200
    assert response.json() == {"imported": 0, "skipped": 0, "prospects": []}


def test_discover_falls_back_to_simulated_dataset_when_no_webhook_is_configured(
    two_orgs, monkeypatch
):
    # DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL is unset (the real default) - invoke_discovery
    # must never even be called, since it would only time out against the vendor's URL.
    monkeypatch.delenv("DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL", raising=False)
    monkeypatch.setattr(
        prospects, "invoke_discovery", lambda payload: pytest.fail("should not be called")
    )
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"
    campaign_id = client.post("/campaigns", json={"name": "SaaS ICP"}).json()["id"]

    first = client.post(f"/campaigns/{campaign_id}/prospects/discover")
    assert first.status_code == 200
    assert first.json()["imported"] == prospects._DEMO_DISCOVERY_BATCH
    assert all(p["full_name"] for p in first.json()["prospects"])

    # a second click surfaces a fresh batch, not the same 25 people again (dedupe is by
    # email, not name - the synthetic dataset repeats some names across different people)
    second = client.post(f"/campaigns/{campaign_id}/prospects/discover")
    assert second.json()["imported"] == prospects._DEMO_DISCOVERY_BATCH
    total = len(client.get(f"/campaigns/{campaign_id}/prospects").json())
    assert total == 2 * prospects._DEMO_DISCOVERY_BATCH


def test_simulate_discovery_is_deterministic_per_campaign_and_excludes_seen_emails():
    first_call = dronahq_discovery.simulate_discovery("campaign-1", exclude_emails=set(), limit=5)
    second_call = dronahq_discovery.simulate_discovery("campaign-1", exclude_emails=set(), limit=5)
    assert first_call == second_call  # same campaign id -> same simulated ICP group

    seen = {p["email"].lower() for p in first_call if p["email"]}
    excluded = dronahq_discovery.simulate_discovery("campaign-1", exclude_emails=seen, limit=5)
    assert seen.isdisjoint({p["email"].lower() for p in excluded if p["email"]})


def test_narrative_agent_response_is_extracted_by_the_llm(monkeypatch):
    monkeypatch.setattr(
        dronahq_discovery,
        "call_structured",
        lambda **_kwargs: (
            dronahq_discovery.ProspectExtraction(
                prospects=[
                    dronahq_discovery.ExtractedProspect(
                        full_name="Avery Chen",
                        email="avery@acme.test",
                        company="Acme",
                        role="CTO",
                    )
                ]
            ),
            object(),
        ),
    )
    records = dronahq_discovery.extract_prospects(
        {"success": True, "response": "Avery Chen is CTO at Acme."}, org_id="org-1"
    )

    assert records == [
        {
            "full_name": "Avery Chen",
            "email": "avery@acme.test",
            "company": "Acme",
            "role": "CTO",
        }
    ]
