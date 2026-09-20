"""API-level tests for the campaign lifecycle (spec sections 7 and 10), through the
real FastAPI app against a real Postgres — proving the routes, the repository layer and
the org-scoping all work together, not just each piece in isolation.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def test_create_campaign_starts_as_draft_with_an_empty_funnel(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post("/campaigns", json={"name": "Q4 Outbound"})

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft"
    assert body["funnel"]["discovered"] == 0


def test_activate_blocked_until_preflight_is_green(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    response = client.post(f"/campaigns/{campaign_id}/activate")

    assert response.status_code == 409
    body = response.json()
    assert body["code"] == "not_ready"
    assert any(not c["ok"] for c in body["details"]["checks"])


def test_pause_then_resume_round_trip(two_orgs, admin_conn):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]
    # Force the campaign live directly (bypassing preflight) to test the pause/resume
    # transition itself, which is a separate concern from the preflight gate.
    admin_conn.execute("update campaigns set status = 'live' where id = %s", (campaign_id,))

    paused = client.post(f"/campaigns/{campaign_id}/pause")
    assert paused.json()["status"] == "paused"

    resumed = client.post(f"/campaigns/{campaign_id}/resume")
    assert resumed.json()["status"] == "live"


def test_invalid_transition_is_rejected(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    response = client.post(f"/campaigns/{campaign_id}/pause")  # draft -> paused isn't valid

    assert response.status_code == 409
    assert response.json()["code"] == "invalid_transition"


def test_campaigns_are_isolated_per_org(two_orgs):
    org_a, org_b = two_orgs
    client_a, client_b = _client(org_a), _client(org_b)
    client_a.post("/campaigns", json={"name": "Org A's campaign"})

    assert [c["name"] for c in client_a.get("/campaigns").json()] == ["Org A's campaign"]
    assert client_b.get("/campaigns").json() == []


def test_update_persists_targeting_and_channel_fields(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    response = client.patch(
        f"/campaigns/{campaign_id}",
        json={
            "icp": {"industry": "SaaS", "geography": "US"},
            "target_roles": ["CTO", "VP Eng"],
            "channels": {"enabled": ["email"], "daily_caps": {"email": 30}},
            "channel_policy": {"requires_approval_on_first_touch": True},
            "demo_seconds_per_day": 600,
            "owner": "Jordan Lee",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["icp"] == {"industry": "SaaS", "geography": "US"}
    assert body["target_roles"] == ["CTO", "VP Eng"]
    assert body["channels"]["enabled"] == ["email"]
    assert body["channel_policy"]["requires_approval_on_first_touch"] is True
    assert body["demo_seconds_per_day"] == 600
    assert body["owner"] == "Jordan Lee"

    # sticks on a fresh read, not just the PATCH response
    refetched = client.get(f"/campaigns/{campaign_id}").json()
    assert refetched["icp"] == {"industry": "SaaS", "geography": "US"}


def test_completion_feedback_is_saved_and_returned(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    response = client.post(
        f"/campaigns/{campaign_id}/completion-feedback",
        json={"text": "Great results", "submitted_by": "Jordan Lee"},
    )
    assert response.status_code == 200
    feedback = response.json()["completion_feedback"]
    assert feedback["text"] == "Great results"
    assert feedback["submitted_by"] == "Jordan Lee"
    assert feedback["submitted_at"]


def test_duplicate_copies_config_and_active_prompts_not_prospects(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post(
        "/campaigns", json={"name": "Q4 Outbound", "icp": {"industry": "SaaS"}, "fit_threshold": 80}
    ).json()["id"]
    client.post(
        f"/campaigns/{campaign_id}/prospects",
        json={"full_name": "Jordan Lee", "company": "Acme", "email": "jordan@acme.test"},
    )
    client.post(
        f"/campaigns/{campaign_id}/prompts/strategy/versions",
        json={"content": "Custom strategy prompt", "author": "Jordan", "changelog": "v1"},
    )

    response = client.post(f"/campaigns/{campaign_id}/duplicate")
    assert response.status_code == 201
    copy = response.json()
    assert copy["id"] != campaign_id
    assert copy["name"] == "Q4 Outbound (Copy)"
    assert copy["status"] == "draft"
    assert copy["parent_campaign_id"] == campaign_id
    assert copy["variant_label"] == "Copy"
    assert copy["icp"] == {"industry": "SaaS"}
    assert copy["fit_threshold"] == 80
    assert copy["funnel"]["discovered"] == 0  # prospects aren't copied

    copy_prompts = client.get(f"/campaigns/{copy['id']}/prompts").json()
    strategy = next(p for p in copy_prompts if p["agent"] == "strategy")
    assert strategy["version"]["content"] == "Custom strategy prompt"
    assert strategy["version"]["version"] == 1

    # duplicating twice doesn't collide on name
    second = client.post(f"/campaigns/{campaign_id}/duplicate").json()
    assert second["name"] == "Q4 Outbound (Copy) 2"


def test_delete_removes_campaign_and_its_dependent_rows(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]
    rep_id = client.post("/reps", json={"name": "Jordan Lee"}).json()["id"]
    client.post(f"/campaigns/{campaign_id}/reps", json={"rep_id": rep_id})
    client.post(
        f"/campaigns/{campaign_id}/prospects",
        json={"full_name": "Sam Rivera", "company": "Acme", "email": "sam@acme.test"},
    )

    response = client.delete(f"/campaigns/{campaign_id}")
    assert response.status_code == 204
    assert client.get(f"/campaigns/{campaign_id}").status_code == 404
    assert client.get("/campaigns").json() == []
    # the rep itself isn't deleted, just its assignment to the deleted campaign
    assert client.get(f"/reps/{rep_id}/assignments").json() == []


def test_metrics_are_zero_for_a_fresh_campaign_and_reflect_real_activity(two_orgs, admin_conn):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    empty = client.get(f"/campaigns/{campaign_id}/metrics")
    assert empty.status_code == 200
    body = empty.json()
    assert body["outcomes"] == {
        "positive": 0, "negative": 0, "no_reply": 0, "meetings": 0,
        "opportunities": 0, "conversion_rate": 0.0,
    }
    assert body["cost"]["total_usd"] == 0.0
    assert body["touches_sent_today"] == 0
    assert body["agents"]["active"] == 6  # 6 pipeline agents, none paused yet

    cp_id = client.post(
        f"/campaigns/{campaign_id}/prospects",
        json={"full_name": "Jordan Lee", "company": "Acme", "email": "jordan@acme.test"},
    ).json()["id"]
    admin_conn.execute(
        "update campaign_prospects set stage = 'contacted' where id = %s", (cp_id,)
    )
    admin_conn.execute(
        "insert into touches (org_id, cp_id, channel, direction, kind, status, sent_at) "
        "values (%s, %s, 'email', 'outbound', 'email', 'sent', now())",
        (str(org_a.id), cp_id),
    )
    admin_conn.execute(
        "insert into agent_runs (org_id, cp_id, campaign_id, agent, status, cost_usd) "
        "values (%s, %s, %s, 'research', 'ok', 0.05)",
        (str(org_a.id), cp_id, campaign_id),
    )

    after = client.get(f"/campaigns/{campaign_id}/metrics").json()
    assert after["outreach"]["email"] == {"sent": 1, "replies": 0}
    assert after["outcomes"]["no_reply"] == 1  # contacted, no inbound touch yet
    assert after["cost"]["total_usd"] == 0.05
    assert after["touches_sent_today"] == 1


def test_adding_a_prospect_and_reading_its_timeline(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    campaign_id = client.post("/campaigns", json={"name": "Q4 Outbound"}).json()["id"]

    prospect = client.post(
        f"/campaigns/{campaign_id}/prospects",
        json={"full_name": "Jordan Lee", "company": "Acme Logistics", "email": "jordan@acme.test"},
    )
    assert prospect.status_code == 201
    cp_id = prospect.json()["id"]

    listed = client.get(f"/campaigns/{campaign_id}/prospects").json()
    assert len(listed) == 1
    assert listed[0]["stage"] == "discovered"

    timeline = client.get(f"/prospects/{cp_id}/timeline")
    assert timeline.status_code == 200
    assert timeline.json() == []  # nothing has happened to it yet - empty, not an error
