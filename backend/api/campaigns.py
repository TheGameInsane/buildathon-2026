"""Campaign CRUD, lifecycle and preflight routes (spec sections 7 and 10)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from orchestrator import prompts as prompt_store
from orchestrator.common import now

router = APIRouter(tags=["campaigns"])

_FUNNEL_STAGES = [
    "discovered", "researched", "qualified", "disqualified",
    "contacted", "engaged", "meeting", "opportunity", "stopped",
]  # fmt: skip

# spec section 7: draft -> live <-> paused -> completed -> archived
_VALID_TRANSITIONS: dict[str, set[str]] = {
    "draft": {"live"},
    "live": {"paused", "completed"},
    "paused": {"live", "completed"},
    "completed": {"archived"},
    "archived": set(),
}


class CampaignCreateRequest(BaseModel):
    name: str
    description: str | None = None
    objective: str | None = None
    owner: str | None = None
    icp: dict = Field(default_factory=dict)
    target_roles: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    channels: dict = Field(default_factory=dict)
    channel_policy: dict = Field(default_factory=dict)
    fit_threshold: int = 70
    demo_seconds_per_day: int | None = None


class CampaignSummary(BaseModel):
    id: str
    name: str
    description: str | None
    owner: str | None
    status: str
    fit_threshold: int
    funnel: dict[str, int]
    icp: dict
    target_roles: list[str]
    languages: list[str]
    channels: dict
    channel_policy: dict
    demo_seconds_per_day: int | None
    parent_campaign_id: str | None
    variant_label: str | None
    completion_feedback: dict | None


def _funnel(ctx: RequestContext, campaign_id: str) -> dict[str, int]:
    rows = ctx.conn.execute(
        "select stage, count(*) as n from campaign_prospects where campaign_id = %s group by stage",
        (campaign_id,),
    ).fetchall()
    counts = {r["stage"]: r["n"] for r in rows}
    return {stage: counts.get(stage, 0) for stage in _FUNNEL_STAGES}


def _summary(ctx: RequestContext, row: dict) -> CampaignSummary:
    return CampaignSummary(
        id=str(row["id"]),
        name=row["name"],
        description=row.get("description"),
        owner=row.get("owner"),
        status=row["status"],
        fit_threshold=row["fit_threshold"],
        funnel=_funnel(ctx, row["id"]),
        icp=row.get("icp") or {},
        target_roles=row.get("target_roles") or [],
        languages=row.get("languages") or [],
        channels=row.get("channels") or {},
        channel_policy=row.get("channel_policy") or {},
        demo_seconds_per_day=row.get("demo_seconds_per_day"),
        parent_campaign_id=(
            str(row["parent_campaign_id"]) if row.get("parent_campaign_id") else None
        ),
        variant_label=row.get("variant_label"),
        completion_feedback=row.get("completion_feedback"),
    )


def _jsonb_fields(data: dict, *keys: str) -> dict:
    """Wraps dict-shaped values headed for a jsonb column - psycopg adapts a plain
    `dict` to jsonb automatically (db/connection.py), so only list-of-dict fields
    (JSON arrays) need the explicit Jsonb() wrap."""
    return {**data, **{k: Jsonb(data[k]) for k in keys if k in data and data[k] is not None}}


@router.get("/campaigns", response_model=list[CampaignSummary])
def list_campaigns(ctx: RequestContext = Depends(get_ctx)) -> list[CampaignSummary]:
    rows = ctx.repo.list("campaigns", order_by="created_at")
    return [_summary(ctx, row) for row in rows]


@router.post("/campaigns", response_model=CampaignSummary, status_code=201)
def create_campaign(
    body: CampaignCreateRequest, ctx: RequestContext = Depends(get_ctx)
) -> CampaignSummary:
    data = _jsonb_fields(body.model_dump(), "icp", "channels", "channel_policy")
    data["created_by"] = ctx.actor
    row = ctx.repo.insert("campaigns", data)
    return _summary(ctx, row)


@router.get("/campaigns/{campaign_id}", response_model=CampaignSummary)
def get_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    return _summary(ctx, ctx.repo.get("campaigns", campaign_id))


class CampaignUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    owner: str | None = None
    icp: dict | None = None
    target_roles: list[str] | None = None
    languages: list[str] | None = None
    channels: dict | None = None
    channel_policy: dict | None = None
    fit_threshold: int | None = None
    demo_seconds_per_day: int | None = None


@router.patch("/campaigns/{campaign_id}", response_model=CampaignSummary)
def update_campaign(
    campaign_id: str, body: CampaignUpdateRequest, ctx: RequestContext = Depends(get_ctx)
) -> CampaignSummary:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        return _summary(ctx, ctx.repo.get("campaigns", campaign_id))
    updates = _jsonb_fields(updates, "icp", "channels", "channel_policy")
    return _summary(ctx, ctx.repo.update("campaigns", campaign_id, updates))


# ---------------------------------------------------------------------------
# Preflight (spec section 10's Preflight shape; gates draft -> live)
# ---------------------------------------------------------------------------

_PreflightKey = Literal[
    "company_profile_set", "icp_set", "prompts_active", "kb_min_5_docs",
    "rep_assigned", "channels_connected", "org_active_for_live",
]  # fmt: skip


class PreflightCheck(BaseModel):
    key: _PreflightKey
    ok: bool
    message: str


class Preflight(BaseModel):
    ready: bool
    checks: list[PreflightCheck]


def _preflight(ctx: RequestContext, campaign_id: str) -> Preflight:
    campaign = ctx.repo.get("campaigns", campaign_id)
    org_row = ctx.conn.execute(
        "select status from organizations where id = %s", (ctx.org_id,)
    ).fetchone()
    has_profile = bool(ctx.repo.list("company_profiles"))
    kb_count = ctx.conn.execute(
        "select count(*) as n from kb_documents "
        "where org_id = %s and (campaign_id = %s or campaign_id is null)",
        (ctx.org_id, campaign_id),
    ).fetchone()["n"]
    rep_count = ctx.conn.execute(
        "select count(*) as n from rep_campaigns where campaign_id = %s", (campaign_id,)
    ).fetchone()["n"]
    has_live_integration = any(i["mode"] == "live" for i in ctx.repo.list("integrations"))
    prompt_versions = ctx.repo.list("prompt_versions", filters={"campaign_id": campaign_id})
    has_custom_prompt = len(prompt_versions) > 0

    checks = [
        PreflightCheck(
            key="company_profile_set", ok=has_profile,
            message="Company profile is set" if has_profile else "Company profile is missing",
        ),
        PreflightCheck(
            key="icp_set", ok=bool(campaign.get("icp")),
            message="ICP is set" if campaign.get("icp") else "ICP is not defined",
        ),
        PreflightCheck(
            key="prompts_active", ok=True,
            message=(
                "Custom prompts active in Prompt Studio" if has_custom_prompt
                else "Using default prompt templates"
            ),
        ),
        PreflightCheck(
            key="kb_min_5_docs", ok=kb_count >= 5,
            message=f"{kb_count}/5 knowledge base documents",
        ),
        PreflightCheck(
            key="rep_assigned", ok=rep_count > 0,
            message="A rep is assigned" if rep_count > 0 else "No rep assigned",
        ),
        PreflightCheck(
            key="channels_connected",
            ok=has_live_integration,
            message=(
                "A live channel is connected" if has_live_integration else "No channel live yet"
            ),
        ),
        PreflightCheck(
            key="org_active_for_live",
            ok=org_row["status"] == "active",
            message=(
                "Workspace is active"
                if org_row["status"] == "active"
                else f"Workspace is {org_row['status']}"
            ),
        ),
    ]
    return Preflight(ready=all(c.ok for c in checks), checks=checks)


@router.get("/campaigns/{campaign_id}/preflight", response_model=Preflight)
def get_preflight(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> Preflight:
    return _preflight(ctx, campaign_id)


# ---------------------------------------------------------------------------
# Metrics (spec section 10's CampaignMetrics shape) - every number here is computed
# from touches/agent_runs/campaign_prospects, not invented; a fresh campaign with no
# activity yet honestly reports zeros rather than sample data.
# ---------------------------------------------------------------------------


class ChannelOutreach(BaseModel):
    sent: int
    replies: int


class Outcomes(BaseModel):
    positive: int  # touches of kind "meeting"
    negative: int  # stage disqualified or stopped
    no_reply: int  # contacted, no inbound touch yet
    meetings: int
    opportunities: int
    conversion_rate: float  # opportunities / prospects that reached qualified-or-further, 0-100


class AgentCounts(BaseModel):
    active: int  # campaign_agents rows not paused (campaigns with no custom config count as active)
    completed: int
    failed: int
    pending_approvals: int
    escalations: int


class Cost(BaseModel):
    total_usd: float
    per_prospect: float
    per_qualified_lead: float
    per_conversation: float


class ResponseRates(BaseModel):
    reply_rate: float  # inbound touches / outbound sent, 0-100
    positive_reply_rate: float  # meetings / outbound sent, 0-100
    meeting_rate: float  # meetings / prospects that reached qualified-or-further, 0-100


class CampaignMetrics(BaseModel):
    funnel: dict[str, int]
    outreach: dict[str, ChannelOutreach]
    outcomes: Outcomes
    agents: AgentCounts
    cost: Cost
    response_rates: ResponseRates
    touches_sent_today: int
    prospects_researched_today: int


def _pct(numerator: float, denominator: float) -> float:
    return round(numerator / denominator * 100, 1) if denominator else 0.0


def _rate(numerator: float, denominator: float) -> float:
    return round(numerator / denominator, 4) if denominator else 0.0


@router.get("/campaigns/{campaign_id}/metrics", response_model=CampaignMetrics)
def get_campaign_metrics(
    campaign_id: str, ctx: RequestContext = Depends(get_ctx)
) -> CampaignMetrics:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    org_id = ctx.org_id
    funnel = _funnel(ctx, campaign_id)

    outreach_rows = ctx.conn.execute(
        "select t.channel, "
        "count(*) filter (where t.direction = 'outbound' and t.status in ('sent','delivered')) "
        "as sent, count(*) filter (where t.direction = 'inbound') as replies "
        "from touches t join campaign_prospects cp on cp.id = t.cp_id "
        "where t.org_id = %s and cp.campaign_id = %s and t.channel is not null group by t.channel",
        (org_id, campaign_id),
    ).fetchall()
    outreach = {
        r["channel"]: ChannelOutreach(sent=r["sent"], replies=r["replies"]) for r in outreach_rows
    }
    total_sent = sum(o.sent for o in outreach.values())
    total_replies = sum(o.replies for o in outreach.values())

    meetings = ctx.conn.execute(
        "select count(distinct t.cp_id) as n from touches t "
        "join campaign_prospects cp on cp.id = t.cp_id "
        "where t.org_id = %s and cp.campaign_id = %s and t.kind = 'meeting'",
        (org_id, campaign_id),
    ).fetchone()["n"]
    no_reply = ctx.conn.execute(
        "select count(*) as n from campaign_prospects cp where cp.org_id = %s "
        "and cp.campaign_id = %s and cp.stage = 'contacted' and not exists "
        "(select 1 from touches t where t.cp_id = cp.id and t.direction = 'inbound')",
        (org_id, campaign_id),
    ).fetchone()["n"]
    qualified_or_further = sum(
        funnel.get(s, 0) for s in ("qualified", "contacted", "engaged", "meeting", "opportunity")
    )
    opportunities = funnel.get("opportunity", 0)
    negative = funnel.get("disqualified", 0) + funnel.get("stopped", 0)

    status_counts_rows = ctx.conn.execute(
        "select status, count(*) as n from agent_runs "
        "where org_id = %s and campaign_id = %s group by status",
        (org_id, campaign_id),
    ).fetchall()
    status_counts = {r["status"]: r["n"] for r in status_counts_rows}
    pending_approvals = ctx.conn.execute(
        "select count(*) as n from approvals "
        "where org_id = %s and campaign_id = %s and status = 'pending'",
        (org_id, campaign_id),
    ).fetchone()["n"]
    paused_agents = ctx.conn.execute(
        "select count(*) as n from campaign_agents "
        "where org_id = %s and campaign_id = %s and paused = true",
        (org_id, campaign_id),
    ).fetchone()["n"]

    cost_total = float(
        ctx.conn.execute(
            "select coalesce(sum(cost_usd), 0) as total from agent_runs "
            "where org_id = %s and campaign_id = %s",
            (org_id, campaign_id),
        ).fetchone()["total"]
    )
    prospect_count = sum(funnel.values())
    conversations = ctx.conn.execute(
        "select count(distinct t.cp_id) as n from touches t "
        "join campaign_prospects cp on cp.id = t.cp_id "
        "where t.org_id = %s and cp.campaign_id = %s and t.direction = 'inbound'",
        (org_id, campaign_id),
    ).fetchone()["n"]

    today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    touches_sent_today = ctx.conn.execute(
        "select count(*) as n from touches t join campaign_prospects cp on cp.id = t.cp_id "
        "where t.org_id = %s and cp.campaign_id = %s and t.direction = 'outbound' "
        "and t.status in ('sent','delivered') and t.sent_at >= %s",
        (org_id, campaign_id, today_start),
    ).fetchone()["n"]
    prospects_researched_today = ctx.conn.execute(
        "select count(distinct cp_id) as n from agent_runs "
        "where org_id = %s and campaign_id = %s and agent = 'research' and created_at >= %s",
        (org_id, campaign_id, today_start),
    ).fetchone()["n"]

    return CampaignMetrics(
        funnel=funnel,
        outreach=outreach,
        outcomes=Outcomes(
            positive=meetings, negative=negative, no_reply=no_reply, meetings=meetings,
            opportunities=opportunities, conversion_rate=_pct(opportunities, qualified_or_further),
        ),  # fmt: skip
        agents=AgentCounts(
            # 6 pipeline agents minus however many this campaign has explicitly paused
            # (campaign_agents has no row at all until a prompt is customised or paused).
            active=len(prompt_store.DEFAULT_PROMPTS) - paused_agents,
            completed=status_counts.get("ok", 0) + status_counts.get("repaired", 0),
            failed=status_counts.get("failed", 0),
            pending_approvals=pending_approvals,
            escalations=status_counts.get("fallback", 0),
        ),
        cost=Cost(
            total_usd=round(cost_total, 4),
            per_prospect=round(_rate(cost_total, prospect_count), 4),
            per_qualified_lead=round(_rate(cost_total, qualified_or_further), 4),
            per_conversation=round(_rate(cost_total, conversations), 4),
        ),
        response_rates=ResponseRates(
            reply_rate=_pct(total_replies, total_sent),
            positive_reply_rate=_pct(meetings, total_sent),
            meeting_rate=_pct(meetings, qualified_or_further),
        ),
        touches_sent_today=touches_sent_today,
        prospects_researched_today=prospects_researched_today,
    )


def _transition(ctx: RequestContext, campaign_id: str, target: str) -> CampaignSummary:
    row = ctx.repo.get("campaigns", campaign_id)
    current = row["status"]
    if target not in _VALID_TRANSITIONS.get(current, set()):
        message = f"Cannot move campaign from {current} to {target}"
        raise api_error(409, "invalid_transition", message)
    updated = ctx.repo.update("campaigns", campaign_id, {"status": target})
    return _summary(ctx, updated)


@router.post("/campaigns/{campaign_id}/activate", response_model=CampaignSummary)
def activate_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    preflight = _preflight(ctx, campaign_id)
    if not preflight.ready:
        raise api_error(
            409, "not_ready", "Preflight checklist is not fully green",
            {"checks": [c.model_dump() for c in preflight.checks]},
        )
    return _transition(ctx, campaign_id, "live")


@router.post("/campaigns/{campaign_id}/pause", response_model=CampaignSummary)
def pause_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    return _transition(ctx, campaign_id, "paused")


@router.post("/campaigns/{campaign_id}/resume", response_model=CampaignSummary)
def resume_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    result = _transition(ctx, campaign_id, "live")
    # spec section 7: "On resume: all held touches for that campaign go back to
    # Strategy" - nudge every non-terminal prospect so the worker re-evaluates them
    # rather than blindly resending whatever was queued.
    ctx.conn.execute(
        "update campaign_prospects set next_action_at = now() "
        "where campaign_id = %s and stage not in ('disqualified', 'stopped')",
        (campaign_id,),
    )
    return result


@router.post("/campaigns/{campaign_id}/complete", response_model=CampaignSummary)
def complete_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    return _transition(ctx, campaign_id, "completed")


@router.post("/campaigns/{campaign_id}/archive", response_model=CampaignSummary)
def archive_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    return _transition(ctx, campaign_id, "archived")


class CompletionFeedbackRequest(BaseModel):
    text: str
    submitted_by: str


@router.post("/campaigns/{campaign_id}/completion-feedback", response_model=CampaignSummary)
def submit_completion_feedback(
    campaign_id: str, body: CompletionFeedbackRequest, ctx: RequestContext = Depends(get_ctx)
) -> CampaignSummary:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    feedback = {
        "text": body.text, "submitted_by": body.submitted_by, "submitted_at": now().isoformat(),
    }  # fmt: skip
    row = ctx.repo.update("campaigns", campaign_id, {"completion_feedback": Jsonb(feedback)})
    return _summary(ctx, row)


# Columns copied verbatim onto a duplicate (spec section 7's `duplicate`: "copying
# config" - everything that describes how the campaign runs, not what it has done).
_DUPLICATE_CONFIG_COLUMNS = [
    "description", "objective", "icp", "geography", "target_roles", "company_criteria",
    "exclusion_criteria", "reference_profiles", "languages", "channels", "channel_policy",
    "daily_limits", "approval_rules", "timezone_rules", "fit_threshold", "demo_seconds_per_day",
]  # fmt: skip


@router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignSummary, status_code=201)
def duplicate_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> CampaignSummary:
    """spec section 7: "creates a new `draft` campaign copying config and the active
    prompt versions (as version 1), sets `parent_campaign_id` and `variant_label`.
    Prospects, touches and metrics are not copied." """
    original = ctx.repo.get("campaigns", campaign_id)

    existing_names = {
        r["name"] for r in ctx.repo.list("campaigns", filters={"parent_campaign_id": campaign_id})
    }
    base_name = f"{original['name']} (Copy)"
    name, n = base_name, 2
    while name in existing_names:
        name = f"{base_name} {n}"
        n += 1

    data = {col: original.get(col) for col in _DUPLICATE_CONFIG_COLUMNS}
    for key in ("icp", "geography", "company_criteria", "exclusion_criteria", "reference_profiles",
                "channels", "channel_policy", "daily_limits", "approval_rules", "timezone_rules"):
        if data.get(key) is not None:
            data[key] = Jsonb(data[key])
    data.update(
        name=name, owner=original.get("owner"), status="draft",
        parent_campaign_id=campaign_id, variant_label="Copy", created_by=ctx.actor,
    )
    copy_row = ctx.repo.insert("campaigns", data)

    for agent in prompt_store.DEFAULT_PROMPTS:
        body, _version_id = prompt_store.active_prompt(ctx.conn, ctx.org_id, campaign_id, agent)
        if body is None:
            continue
        version_row = ctx.repo.insert(
            "prompt_versions",
            {
                "campaign_id": copy_row["id"], "agent": agent, "version": 1, "body": body,
                "note": f"Copied from {original['name']}", "created_by": ctx.actor,
            },
        )
        prompt_store.activate(ctx.conn, ctx.org_id, copy_row["id"], agent, version_row["id"])

    return _summary(ctx, copy_row)


def _delete_campaign_cascade(ctx: RequestContext, campaign_id: str) -> None:
    """No `on delete cascade` on `campaign_id` FKs (db/migrations/0003_sales_domain.sql)
    - deleting a campaign has to clean up every table that points at it itself, in
    dependency order, all inside the request's one transaction (api/deps.py) so a
    failure partway through rolls the whole delete back rather than leaving orphans."""
    org_id = ctx.org_id
    ctx.conn.execute(
        "delete from touches where org_id = %s and cp_id in "
        "(select id from campaign_prospects where org_id = %s and campaign_id = %s)",
        (org_id, org_id, campaign_id),
    )
    ctx.conn.execute(
        "delete from approvals where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "delete from agent_runs where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "delete from campaign_prospects where org_id = %s and campaign_id = %s",
        (org_id, campaign_id),
    )
    ctx.conn.execute(
        "delete from rep_campaigns where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "delete from campaign_agents where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "delete from prompt_versions where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "delete from kb_documents where org_id = %s and campaign_id = %s", (org_id, campaign_id)
    )
    ctx.conn.execute(
        "update prospects set owner_campaign_id = null "
        "where org_id = %s and owner_campaign_id = %s",
        (org_id, campaign_id),
    )
    ctx.conn.execute(
        "update campaigns set parent_campaign_id = null "
        "where org_id = %s and parent_campaign_id = %s",
        (org_id, campaign_id),
    )


@router.delete("/campaigns/{campaign_id}", status_code=204)
def delete_campaign(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> None:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    _delete_campaign_cascade(ctx, campaign_id)
    ctx.repo.delete("campaigns", campaign_id)
