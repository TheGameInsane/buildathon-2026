"""Inbox routes (spec section 10): approvals and conflicts in one list, plus
approve/reject/edit and conflict resolution."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from orchestrator.policy_gate import Action, check_gate

router = APIRouter(tags=["inbox"])


class InboxItem(BaseModel):
    kind: str  # "approval" | "conflict"
    id: str
    campaign_id: str | None
    reason: str | None
    status: str
    created_at: str


@router.get("/inbox", response_model=list[InboxItem])
def get_inbox(ctx: RequestContext = Depends(get_ctx)) -> list[InboxItem]:
    approvals = ctx.repo.list("approvals", filters={"status": "pending"})
    conflicts = ctx.repo.list("conflicts", filters={"status": "open"})
    items = [
        InboxItem(
            kind="approval",
            id=str(a["id"]),
            campaign_id=str(a["campaign_id"]) if a.get("campaign_id") else None,
            reason=a.get("reason"),
            status=a["status"],
            created_at=a["created_at"].isoformat(),
        )
        for a in approvals
    ] + [
        InboxItem(
            kind="conflict",
            id=str(c["id"]),
            campaign_id=None,
            reason=c.get("type"),
            status=c["status"],
            created_at=c["created_at"].isoformat(),
        )
        for c in conflicts
    ]
    items.sort(key=lambda i: i.created_at)
    return items


def _require_pending(ctx: RequestContext, approval_id: str) -> dict:
    approval = ctx.repo.get("approvals", approval_id)
    if approval["status"] != "pending":
        raise api_error(409, "not_pending", "This approval has already been decided")
    return approval


@router.post("/approvals/{approval_id}/approve")
def approve_approval(approval_id: str, ctx: RequestContext = Depends(get_ctx)) -> dict:
    approval = _require_pending(ctx, approval_id)
    ctx.repo.update(
        "approvals",
        approval_id,
        {"status": "approved", "decided_by": ctx.actor, "decided_at": datetime.now(UTC)},
    )

    if approval.get("touch_id"):
        touch = ctx.repo.get("touches", approval["touch_id"])
        cp = ctx.repo.get("campaign_prospects", touch["cp_id"])
        action = Action(agent="strategy", channel=touch.get("channel"), approved=True)
        gate_result = check_gate(ctx.conn, ctx.org_id, cp["id"], action)
        if gate_result.allowed:
            now = datetime.now(UTC)
            ctx.repo.update("touches", touch["id"], {"status": "sent", "sent_at": now})
            ctx.repo.update("campaign_prospects", cp["id"], {"next_action_at": now})
        # If the gate still says no (e.g. the campaign was paused in the meantime),
        # the touch stays held - the worker's next pass re-evaluates it via Strategy.
    return {"status": "approved"}


@router.post("/approvals/{approval_id}/reject")
def reject_approval(approval_id: str, ctx: RequestContext = Depends(get_ctx)) -> dict:
    approval = _require_pending(ctx, approval_id)
    ctx.repo.update(
        "approvals",
        approval_id,
        {"status": "rejected", "decided_by": ctx.actor, "decided_at": datetime.now(UTC)},
    )
    if approval.get("touch_id"):
        ctx.repo.update("touches", approval["touch_id"], {"status": "cancelled"})
    return {"status": "rejected"}


class EditApprovalRequest(BaseModel):
    edited_body: str


@router.post("/approvals/{approval_id}/edit")
def edit_approval(
    approval_id: str, body: EditApprovalRequest, ctx: RequestContext = Depends(get_ctx)
) -> dict:
    approval = _require_pending(ctx, approval_id)
    ctx.repo.update("approvals", approval_id, {"edited_body": body.edited_body})
    if approval.get("touch_id"):
        ctx.repo.update("touches", approval["touch_id"], {"body": body.edited_body})
    return {"status": "edited"}


class ResolveConflictRequest(BaseModel):
    resolution: dict = Field(default_factory=dict)


@router.post("/conflicts/{conflict_id}/resolve")
def resolve_conflict(
    conflict_id: str, body: ResolveConflictRequest, ctx: RequestContext = Depends(get_ctx)
) -> dict:
    ctx.repo.get("conflicts", conflict_id)  # 404s if not this org's
    ctx.repo.update(
        "conflicts",
        conflict_id,
        {
            "status": "resolved",
            "resolution": Jsonb(body.resolution),
            "resolved_by": ctx.actor,
            "resolved_at": datetime.now(UTC),
        },
    )
    return {"status": "resolved"}
