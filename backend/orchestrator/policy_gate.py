"""The policy gate (spec section 8) — the safety system. `check_gate()` is the single
function every external action must pass through: called early when Strategy proposes
an action (so pointless work is never queued), and again, authoritatively, immediately
before the actual send or call. Nothing external happens without passing it here.

It re-reads everything fresh from the database on every call, never from a cached
context the caller assembled earlier — a pause that lands between an action being
queued and it actually sending must still block it (spec section 7).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from agents.types import Channel
from ai.budget import get_budget_status
from db.repository import NotFound, OrgScopedRepo

Disposition = Literal["ok", "held", "cancelled", "rescheduled", "awaiting_approval"]


@dataclass
class Action:
    """What Strategy (or another agent) proposed to do, as far as the gate needs to
    know. `approved` is set by the orchestrator only when re-attempting an action whose
    `approvals` row has already been approved — the gate itself never queries
    `approvals`; it only decides whether approval is *required* (check 13)."""

    agent: str
    channel: Channel | None = None
    approved: bool = False


@dataclass
class GateResult:
    allowed: bool
    code: str
    reason: str
    disposition: Disposition
    conflict_campaign_id: str | None = None


def needs_approval(campaign: dict, action: Action, cp: dict) -> bool:
    """Whether this action requires a human's sign-off before it can send, from the
    campaign's `approval_rules` (spec section 8, check 13). A separate function so the
    orchestrator can call it directly when deciding whether to open an approval."""
    rules = campaign.get("approval_rules") or {}
    if rules.get("all"):
        return True
    if rules.get("first_touch") and (cp.get("step_number") or 0) == 0:
        return True
    return bool(action.channel and rules.get(str(action.channel)))


def _rep_in_working_hours(rep: dict, now: datetime) -> bool:
    tz = ZoneInfo(rep["timezone"]) if rep.get("timezone") else UTC
    local = now.astimezone(tz)
    work_days = rep.get("work_days") or list(range(1, 8))
    if local.isoweekday() not in work_days:
        return False
    start, end = rep.get("work_start"), rep.get("work_end")
    if start is None or end is None:
        return True
    return start <= local.time() <= end


def _is_suppressed(conn, org_id: str, prospect: dict) -> bool:
    """Compares only the identifiers the prospect actually has — an absent email must
    never match a suppression row that also has a null email."""
    conditions: list[str] = []
    params: list[str] = [org_id]
    if prospect.get("email"):
        conditions.append("lower(email) = lower(%s)")
        params.append(prospect["email"])
    if prospect.get("phone"):
        conditions.append("phone = %s")
        params.append(prospect["phone"])
    if prospect.get("linkedin_url"):
        conditions.append("linkedin_url = %s")
        params.append(prospect["linkedin_url"])
    if not conditions:
        return False
    query = f"select 1 from suppression where org_id = %s and ({' or '.join(conditions)}) limit 1"  # noqa: S608
    return conn.execute(query, params).fetchone() is not None


def _record_conflict(repo: OrgScopedRepo, prospect_id: str, campaign_ids: list[str]) -> None:
    """Idempotent: a prospect already flagged as double-owned doesn't get a second
    conflict row every time the gate re-checks the same situation."""
    existing = repo.list("conflicts", filters={"prospect_id": prospect_id, "status": "open"})
    if any(c["type"] == "duplicate_outreach" for c in existing):
        return
    repo.insert(
        "conflicts",
        {"prospect_id": prospect_id, "campaign_ids": campaign_ids, "type": "duplicate_outreach"},
    )


def check_gate(
    conn, org_id: str, cp_id: str, action: Action, *, now: datetime | None = None
) -> GateResult:
    now = now or datetime.now(UTC)
    repo = OrgScopedRepo(conn, org_id)

    def deny(code: str, reason: str, disposition: Disposition, **extra) -> GateResult:
        repo.insert(
            "activity_log",
            {"actor": f"gate:{action.agent}", "cp_id": cp_id, "action": code, "summary": reason},
        )
        return GateResult(allowed=False, code=code, reason=reason, disposition=disposition, **extra)

    # 1. Platform-wide kill switch (platform_controls carries no org_id; it may also
    # have no row at all if a platform admin has never touched it — absent = off).
    platform = conn.execute("select kill_switch from platform_controls where id = 1").fetchone()
    if platform and platform["kill_switch"]:
        return deny("platform_kill_switch", "Platform-wide stop is on", "held")

    # 2. Organization suspended.
    org = conn.execute(
        "select status, global_contact_cap_7d from organizations where id = %s", (org_id,)
    ).fetchone()
    if org is None:
        return deny("org_not_found", "Organization not found", "held")
    if org["status"] == "suspended":
        return deny("org_suspended", "Workspace suspended", "held")

    # 3. Org kill switch (org_controls may not have a row yet — absent = off).
    org_controls_rows = repo.list("org_controls")
    org_controls = org_controls_rows[0] if org_controls_rows else None
    if org_controls and org_controls["kill_switch"]:
        return deny("org_kill_switch", "Workspace kill switch is on", "held")

    # 4. Org monthly AI budget (reuses ai.budget, the same ledger call_structured checks).
    budget = get_budget_status(org_id)
    if budget.remaining_usd is not None and budget.remaining_usd <= 0:
        return deny("budget_exceeded", "Monthly AI budget reached", "held")

    try:
        cp = repo.get("campaign_prospects", cp_id)
        campaign = repo.get("campaigns", cp["campaign_id"])
        prospect = repo.get("prospects", cp["prospect_id"])
    except NotFound:
        return deny("prospect_not_found", "Prospect not found for this organization", "held")

    # 5. Campaign must be live.
    if campaign["status"] != "live":
        return deny("campaign_not_live", f"Campaign is {campaign['status']}", "held")

    # 6. Agent paused (or disabled) for this campaign. No row yet = the column defaults
    # (enabled=true, paused=false) apply.
    agent_rows = repo.list(
        "campaign_agents", filters={"campaign_id": campaign["id"], "agent": action.agent}
    )
    campaign_agent = agent_rows[0] if agent_rows else None
    if campaign_agent and campaign_agent["paused"]:
        return deny("agent_paused", f"{action.agent} agent paused", "held")
    if campaign_agent and not campaign_agent["enabled"]:
        return deny("agent_disabled", f"{action.agent} agent disabled", "held")

    # 7. Channel paused, org- or campaign-level.
    if action.channel:
        campaign_channels = campaign.get("channels") or {}
        if (campaign_channels.get(action.channel) or {}).get("paused"):
            return deny("channel_paused", f"{action.channel} paused", "held")
        channel_pauses = (org_controls["channel_pauses"] if org_controls else None) or {}
        if channel_pauses.get(action.channel):
            return deny("channel_paused", f"{action.channel} paused", "held")

    # 8. Suppression — cancelled, not held: this is permanent, not a wait-and-retry.
    if _is_suppressed(conn, org_id, prospect):
        return deny("suppressed", "Prospect on do-not-contact list", "cancelled")

    # 9. Org-wide 7-day contact cap for this prospect, across every campaign in the org.
    cap = org["global_contact_cap_7d"]
    if cap is not None:
        count_row = conn.execute(
            """
            select count(*) as n
            from touches t
            join campaign_prospects cp2 on cp2.id = t.cp_id
            where cp2.org_id = %s and cp2.prospect_id = %s
              and t.direction = 'outbound' and t.created_at >= %s
            """,
            (org_id, cp["prospect_id"], now - timedelta(days=7)),
        ).fetchone()
        if count_row["n"] >= cap:
            return deny("contact_cap", "Contact limit reached", "rescheduled")

    # 10. Another campaign already owns this prospect.
    owner_campaign_id = prospect.get("owner_campaign_id")
    if owner_campaign_id is not None and owner_campaign_id != campaign["id"]:
        _record_conflict(repo, prospect["id"], [owner_campaign_id, campaign["id"]])
        return deny(
            "prospect_owned_elsewhere",
            "Another campaign owns this prospect",
            "held",
            conflict_campaign_id=owner_campaign_id,
        )

    # 11 & 12. Rep working hours and daily channel cap (only apply once a rep is assigned).
    if cp.get("rep_id"):
        try:
            rep = repo.get("reps", cp["rep_id"])
        except NotFound:
            rep = None
        if rep is not None:
            if not _rep_in_working_hours(rep, now):
                return deny("outside_working_hours", "Outside rep working hours", "rescheduled")
            if action.channel:
                daily_cap = (rep.get("daily_caps") or {}).get(action.channel)
                if daily_cap is not None:
                    sent_today = conn.execute(
                        """
                        select count(*) as n
                        from touches t
                        join campaign_prospects cp2 on cp2.id = t.cp_id
                        where cp2.org_id = %s and cp2.rep_id = %s
                          and t.channel = %s and t.direction = 'outbound'
                          and t.created_at >= date_trunc('day', %s)
                        """,
                        (org_id, rep["id"], action.channel, now),
                    ).fetchone()
                    if sent_today["n"] >= daily_cap:
                        return deny("rep_daily_cap", "Rep daily limit reached", "rescheduled")

    # 13. Approval required and not yet approved.
    if needs_approval(campaign, action, cp) and not action.approved:
        return deny("needs_approval", "Waiting for approval", "awaiting_approval")

    return GateResult(allowed=True, code="ok", reason="ok", disposition="ok")
