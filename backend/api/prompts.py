"""Prompt version routes (spec section 12.4; docs/api_contract.md's "Not built yet"
section previously listed these). Reads and writes go through `orchestrator.prompts`,
the same module `orchestrator/step.py` and `orchestrator/inbound.py` use to decide
what an agent actually runs — activating a version here is the only thing that
changes that; there is no separate hardcoded default sitting elsewhere.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from orchestrator import prompts as prompt_store
from orchestrator.common import now

router = APIRouter(tags=["prompts"])

AgentKey = Literal[
    "research", "fitment", "strategy", "personalisation", "conversation", "follow_up"
]


class PromptVersionResponse(BaseModel):
    version: int
    content: str
    author: str
    timestamp: str
    active: bool
    changelog: str


def _default_response(agent: str) -> PromptVersionResponse:
    return PromptVersionResponse(
        version=0,
        content=prompt_store.default_prompt(agent),
        author="system",
        timestamp=now().isoformat(),
        active=True,
        changelog="Shipped default template — no versions saved yet.",
    )


def _to_response(row: dict, active_id: str | None) -> PromptVersionResponse:
    return PromptVersionResponse(
        version=row["version"],
        content=row["body"],
        author=row.get("created_by") or "unknown",
        timestamp=row["created_at"].isoformat(),
        active=str(row["id"]) == active_id,
        changelog=row.get("note") or "",
    )


@router.get("/campaigns/{campaign_id}/prompts", response_model=list[dict])
def list_active_per_agent(campaign_id: str, ctx: RequestContext = Depends(get_ctx)) -> list[dict]:
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    out = []
    for agent in prompt_store.DEFAULT_PROMPTS:
        versions = ctx.repo.list(
            "prompt_versions", filters={"campaign_id": campaign_id, "agent": agent}
        )
        if not versions:
            out.append({"agent": agent, "version": _default_response(agent).model_dump()})
            continue
        active_id = prompt_store.active_version_id(ctx.conn, ctx.org_id, campaign_id, agent)
        active_row = next((v for v in versions if str(v["id"]) == active_id), None) or max(
            versions, key=lambda v: v["version"]
        )
        out.append({"agent": agent, "version": _to_response(active_row, active_id).model_dump()})
    return out


@router.get(
    "/campaigns/{campaign_id}/prompts/{agent}/versions", response_model=list[PromptVersionResponse]
)
def list_versions(
    campaign_id: str, agent: AgentKey, ctx: RequestContext = Depends(get_ctx)
) -> list[PromptVersionResponse]:
    ctx.repo.get("campaigns", campaign_id)
    rows = ctx.repo.list(
        "prompt_versions", filters={"campaign_id": campaign_id, "agent": agent}, order_by="version"
    )
    if not rows:
        return [_default_response(agent)]
    active_id = prompt_store.active_version_id(ctx.conn, ctx.org_id, campaign_id, agent)
    return [_to_response(row, active_id) for row in rows]


class CreateDraftRequest(BaseModel):
    content: str
    author: str
    changelog: str


@router.post(
    "/campaigns/{campaign_id}/prompts/{agent}/versions",
    response_model=PromptVersionResponse,
    status_code=201,
)
def create_draft(
    campaign_id: str,
    agent: AgentKey,
    body: CreateDraftRequest,
    ctx: RequestContext = Depends(get_ctx),
) -> PromptVersionResponse:
    ctx.repo.get("campaigns", campaign_id)
    existing = ctx.repo.list(
        "prompt_versions", filters={"campaign_id": campaign_id, "agent": agent}
    )
    next_version = max((v["version"] for v in existing), default=0) + 1
    row = ctx.repo.insert(
        "prompt_versions",
        {
            "campaign_id": campaign_id,
            "agent": agent,
            "version": next_version,
            "body": body.content,
            "note": body.changelog,
            "created_by": body.author,
        },
    )
    if not existing:
        # First version ever saved for this agent: activate it immediately, otherwise
        # nothing would be active and Prompt Studio would show a draft that isn't
        # actually what the agent runs.
        prompt_store.activate(ctx.conn, ctx.org_id, campaign_id, agent, row["id"])
    active_id = prompt_store.active_version_id(ctx.conn, ctx.org_id, campaign_id, agent)
    return _to_response(row, active_id)


@router.post(
    "/campaigns/{campaign_id}/prompts/{agent}/versions/{version}/activate", status_code=204
)
def activate_version(
    campaign_id: str, agent: AgentKey, version: int, ctx: RequestContext = Depends(get_ctx)
) -> None:
    ctx.repo.get("campaigns", campaign_id)
    rows = ctx.repo.list(
        "prompt_versions", filters={"campaign_id": campaign_id, "agent": agent, "version": version}
    )
    if not rows:
        raise api_error(404, "not_found", f"No v{version} for {agent} on this campaign")
    prompt_store.activate(ctx.conn, ctx.org_id, campaign_id, agent, rows[0]["id"])
