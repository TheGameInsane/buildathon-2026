"""API-level test proving the /controls route actually wires into the real policy gate
— not just that it writes a row, but that check_gate reads it back and blocks on it.
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from db.connection import org_connection
from db.repository import OrgScopedRepo
from main import app
from orchestrator.policy_gate import Action, check_gate


def test_org_kill_switch_set_via_api_is_seen_by_the_real_gate(two_orgs, admin_conn):
    org_a, _org_b = two_orgs
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org_a.api_key}"

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Q4 Outbound"})
        prospect = repo.insert("prospects", {"full_name": "Jordan Lee"})
        cp = repo.insert(
            "campaign_prospects", {"campaign_id": campaign["id"], "prospect_id": prospect["id"]}
        )
    admin_conn.execute("update campaigns set status = 'live' where id = %s", (campaign["id"],))

    before = client.get("/controls").json()
    assert before == {"kill_switch": False, "channel_pauses": {}}

    response = client.post("/controls", json={"kill_switch": True})
    assert response.json()["kill_switch"] is True

    with org_connection(org_a.id) as conn:
        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))
    assert result.allowed is False
    assert result.code == "org_kill_switch"
