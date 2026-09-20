"""Per-campaign agent config and stats (spec section 10: `GET /campaigns/{id}/agents`,
`PATCH /campaigns/{id}/agents/{agent}`). `campaign_agents` (db/migrations/0003) already
holds enabled/paused/active_prompt_version_id - `orchestrator/prompts.py` upserts a row
into it the moment a prompt version is first activated, but a campaign running purely
on shipped defaults has no row yet for any agent, same fallback `api/prompts.py` uses.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from orchestrator import prompts as prompt_store
from orchestrator.common import now

router = APIRouter(tags=["agents"])

AgentKey = Literal[
    "research", "fitment", "strategy", "personalisation", "conversation", "follow_up"
]  # fmt: skip


class AgentResponse(BaseModel):
    agent: AgentKey
    enabled: bool
    paused: bool
    active_version: int  # 0 = running the shipped default, no version ever activated
    runs_today: int
    succeeded: int
    failed: int
    avg_cost_usd: float
    avg_latency_ms: int
    last_run_at: str | None


def _agent_row(ctx: RequestContext, campaign_id: str, agent: str) -> dict:
    rows = ctx.repo.list("campaign_agents", filters={"campaign_id": campaign_id, "agent": agent})
    return rows[0] if rows else {"enabled": True, "paused": False, "active_prompt_version_id": None}


def _active_version(ctx: RequestContext, version_id: str | None) -> int:
    if version_id is None:
        return 0
    row = ctx.conn.execute(
        "select version from prompt_versions where id = %s", (version_id,)
    ).fetchone()
    return row["version"] if row else 0


def _stats(ctx: RequestContext, campaign_id: str, agent: str) -> dict:
    today_start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    today = ctx.conn.execute(
        "select count(*) as n, "
        "count(*) filter (where status in ('ok', 'repaired')) as succeeded, "
        "count(*) filter (where status = 'failed') as failed, "
        "coalesce(avg(cost_usd), 0) as avg_cost, coalesce(avg(latency_ms), 0) as avg_latency "
        "from agent_runs where org_id = %s and campaign_id = %s and agent = %s "
        "and created_at >= %s",
        (ctx.org_id, campaign_id, agent, today_start),
    ).fetchone()
    last_run = ctx.conn.execute(
        "select max(created_at) as last_run_at from agent_runs "
        "where org_id = %s and campaign_id = %s and agent = %s",
        (ctx.org_id, campaign_id, agent),
    ).fetchone()
    return {
        "runs_today": today["n"], "succeeded": today["succeeded"], "failed": today["failed"],
        "avg_cost_usd": round(float(today["avg_cost"]), 6),
        "avg_latency_ms": int(today["avg_latency"]),
        "last_run_at": last_run["last_run_at"].isoformat() if last_run["last_run_at"] else None,
    }  # fmt: skip


def _to_response(ctx: RequestContext, campaign_id: str, agent: str) -> AgentResponse:
    row = _agent_row(ctx, campaign_id, agent)
    stats = _stats(ctx, campaign_id, agent)
    return AgentResponse(
        agent=agent,
        enabled=row["enabled"],
        paused=row["paused"],
        active_version=_active_version(ctx, row["active_prompt_version_id"]),
        **stats,
    )


@router.get("/campaigns/{campaign_id}/agents", response_model=list[AgentResponse])
def list_agents(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> list[AgentResponse]:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    return [_to_response(ctx, campaign_id, agent) for agent in prompt_store.DEFAULT_PROMPTS]


class AgentUpdateRequest(BaseModel):
    enabled: bool | None = None
    paused: bool | None = None


@router.patch("/campaigns/{campaign_id}/agents/{agent}", response_model=AgentResponse)
def update_agent(
    campaign_id: str,
    agent: AgentKey,
    body: AgentUpdateRequest,
    ctx: RequestContext = Depends(get_ctx),
) -> AgentResponse:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise api_error(400, "no_updates", "Provide enabled and/or paused")

    existing = ctx.repo.list(
        "campaign_agents", filters={"campaign_id": campaign_id, "agent": agent}
    )
    if existing:
        set_clause = ", ".join(f"{col} = %({col})s" for col in updates)  # our own field names
        ctx.conn.execute(
            f"update campaign_agents set {set_clause} where org_id = %(org_id)s "  # noqa: S608
            "and campaign_id = %(campaign_id)s and agent = %(agent)s",
            {**updates, "org_id": ctx.org_id, "campaign_id": campaign_id, "agent": agent},
        )
    else:
        ctx.repo.insert(
            "campaign_agents", {"campaign_id": campaign_id, "agent": agent, **updates}
        )
    return _to_response(ctx, campaign_id, agent)
