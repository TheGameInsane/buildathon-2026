"""The policy gate's required scenarios (spec section 8's own test list), run against a
real Postgres with real RLS (see conftest.py) — not mocked. This is the safety system:
CLAUDE.md calls it non-negotiable, so it gets real database-backed coverage rather than
the lighter, faked-LLM-client tests used elsewhere.
"""

from __future__ import annotations

from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.policy_gate import Action, check_gate


def _campaign(repo: OrgScopedRepo, *, status: str = "live", **overrides) -> dict:
    return repo.insert("campaigns", {"name": "Test Campaign", "status": status, **overrides})


def _prospect(repo: OrgScopedRepo, **overrides) -> dict:
    return repo.insert("prospects", {"full_name": "Jordan Lee", **overrides})


def _cp(repo: OrgScopedRepo, campaign: dict, prospect: dict, **overrides) -> dict:
    return repo.insert(
        "campaign_prospects",
        {"campaign_id": campaign["id"], "prospect_id": prospect["id"], **overrides},
    )


def test_paused_campaign_blocks_a_send_other_live_campaigns_still_send(two_orgs):
    org_a, _org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        paused_campaign = _campaign(repo, status="paused")
        live_campaign = _campaign(repo, status="live")
        prospect = _prospect(repo)
        cp_paused = _cp(repo, paused_campaign, prospect)
        cp_live = _cp(repo, live_campaign, _prospect(repo))

        action = Action(agent="strategy", channel="email")
        blocked = check_gate(conn, org_a.id, cp_paused["id"], action)
        allowed = check_gate(conn, org_a.id, cp_live["id"], action)

    assert blocked.allowed is False
    assert blocked.disposition == "held"
    assert blocked.code == "campaign_not_live"
    assert allowed.allowed is True


def test_org_kill_switch_blocks_everything_in_that_org_not_other_orgs(two_orgs):
    org_a, org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        repo.insert("org_controls", {"kill_switch": True})
        campaign = _campaign(repo)
        cp = _cp(repo, campaign, _prospect(repo))
        result_a = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))

    with org_connection(org_b.id) as conn:
        repo_b = OrgScopedRepo(conn, org_b.id)
        campaign_b = _campaign(repo_b)
        cp_b = _cp(repo_b, campaign_b, _prospect(repo_b))
        result_b = check_gate(conn, org_b.id, cp_b["id"], Action(agent="strategy", channel="email"))

    assert result_a.allowed is False
    assert result_a.code == "org_kill_switch"
    assert result_b.allowed is True  # org A's kill switch never touches org B


def test_platform_kill_switch_blocks_every_org(two_orgs, admin_conn):
    org_a, org_b = two_orgs
    admin_conn.execute(
        "insert into platform_controls (id, kill_switch) values (1, true) "
        "on conflict (id) do update set kill_switch = true"
    )
    try:
        for org in (org_a, org_b):
            with org_connection(org.id) as conn:
                repo = OrgScopedRepo(conn, org.id)
                campaign = _campaign(repo)
                cp = _cp(repo, campaign, _prospect(repo))
                action = Action(agent="strategy", channel="email")
                result = check_gate(conn, org.id, cp["id"], action)
            assert result.allowed is False
            assert result.code == "platform_kill_switch"
    finally:
        admin_conn.execute("update platform_controls set kill_switch = false where id = 1")


def test_suppressed_prospect_is_cancelled_not_just_held(two_orgs):
    org_a, _org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = _campaign(repo)
        prospect = _prospect(repo, email="blocked@example.com")
        repo.insert("suppression", {"email": "blocked@example.com", "reason": "unsubscribed"})
        cp = _cp(repo, campaign, prospect)

        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))

    assert result.allowed is False
    assert result.code == "suppressed"
    assert result.disposition == "cancelled"  # permanent, not a wait-and-retry


def test_prospect_owned_by_another_campaign_is_held_and_creates_a_conflict(two_orgs):
    org_a, _org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        owning_campaign = _campaign(repo)
        other_campaign = _campaign(repo)
        prospect = _prospect(repo, owner_campaign_id=owning_campaign["id"])
        cp = _cp(repo, other_campaign, prospect)

        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))
        conflicts = repo.list("conflicts", filters={"prospect_id": prospect["id"]})

    assert result.allowed is False
    assert result.code == "prospect_owned_elsewhere"
    assert result.conflict_campaign_id == owning_campaign["id"]
    assert len(conflicts) == 1
    assert conflicts[0]["type"] == "duplicate_outreach"


def test_ai_budget_exceeded_holds_the_action(two_orgs):
    org_a, _org_b = two_orgs
    # ai.budget.get_budget_status opens its own connection, so the budget update must
    # be committed (its own `with` block) before check_gate's connection can see it.
    with org_connection(org_a.id) as conn:
        conn.execute("update organizations set monthly_budget_usd = 0 where id = %s", (org_a.id,))
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = _campaign(repo)
        cp = _cp(repo, campaign, _prospect(repo))

    with org_connection(org_a.id) as conn:
        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))

    assert result.allowed is False
    assert result.code == "budget_exceeded"
    assert result.disposition == "held"


def test_action_requiring_approval_is_held_until_approved(two_orgs):
    org_a, _org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = _campaign(repo, approval_rules={"first_touch": True})
        cp = _cp(repo, campaign, _prospect(repo), step_number=0)

        not_yet = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))
        already_approved = check_gate(
            conn, org_a.id, cp["id"], Action(agent="strategy", channel="email", approved=True)
        )

    assert not_yet.allowed is False
    assert not_yet.code == "needs_approval"
    assert not_yet.disposition == "awaiting_approval"
    assert already_approved.allowed is True


def test_a_fully_clear_action_is_allowed(two_orgs):
    org_a, _org_b = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = _campaign(repo)
        cp = _cp(repo, campaign, _prospect(repo))

        result = check_gate(conn, org_a.id, cp["id"], Action(agent="strategy", channel="email"))

    assert result.allowed is True
    assert result.code == "ok"
    assert result.disposition == "ok"
