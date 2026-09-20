"""Org-level controls (spec sections 7 and 10): the org kill switch and per-channel
pauses that `orchestrator.policy_gate.check_gate` reads on every call."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx

router = APIRouter(tags=["controls"])


class ControlsResponse(BaseModel):
    kill_switch: bool
    channel_pauses: dict[str, bool]


def _controls_row(ctx: RequestContext) -> dict:
    rows = ctx.repo.list("org_controls")
    return rows[0] if rows else {"kill_switch": False, "channel_pauses": {}}


@router.get("/controls", response_model=ControlsResponse)
def get_controls(ctx: RequestContext = Depends(get_ctx)) -> ControlsResponse:
    row = _controls_row(ctx)
    return ControlsResponse(
        kill_switch=row["kill_switch"], channel_pauses=row.get("channel_pauses") or {}
    )


class ControlsUpdateRequest(BaseModel):
    kill_switch: bool | None = None
    channel_pauses: dict[str, bool] | None = None


@router.post("/controls", response_model=ControlsResponse)
def update_controls(
    body: ControlsUpdateRequest, ctx: RequestContext = Depends(get_ctx)
) -> ControlsResponse:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "channel_pauses" in updates:
        updates["channel_pauses"] = Jsonb(updates["channel_pauses"])
    updates["updated_by"] = ctx.actor

    # org_controls.org_id is the primary key (no separate `id` column), same as
    # company_profiles - OrgScopedRepo.update assumes an `id` column, so update
    # directly by org_id when a row already exists.
    if ctx.repo.list("org_controls"):
        set_clause = ", ".join(f"{col} = %({col})s" for col in updates)  # our own field names
        ctx.conn.execute(
            f"update org_controls set {set_clause} where org_id = %(org_id)s",  # noqa: S608
            {**updates, "org_id": ctx.org_id},
        )
    else:
        ctx.repo.insert("org_controls", updates)

    return get_controls(ctx)
