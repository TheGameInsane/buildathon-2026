"""Reps CRUD and campaign assignment (spec sections 5 and 10). Working hours, timezone
and daily caps here are what `orchestrator/policy_gate.check_gate` reads for the
"outside rep working hours" / "rep daily limit reached" checks; `rep_campaigns` is what
`agents.personalisation`/`conversation` read to decide whether a touch goes out under
the rep's own identity (spec section 7)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel, Field

from api.deps import RequestContext, get_ctx
from api.errors import api_error

router = APIRouter(tags=["reps"])


def _time_str(value: object) -> str | None:
    return value.isoformat(timespec="minutes") if value is not None else None


class RepResponse(BaseModel):
    id: str
    name: str | None
    email: str | None
    timezone: str | None
    signature: str | None
    work_start: str | None
    work_end: str | None
    work_days: list[int]
    daily_caps: dict
    status: str
    assignments: list[dict] = Field(default_factory=list)


def _to_response(row: dict, assignments: list[dict] | None = None) -> RepResponse:
    return RepResponse(
        id=str(row["id"]),
        name=row["name"],
        email=row["email"],
        timezone=row["timezone"],
        signature=row["signature"],
        work_start=_time_str(row["work_start"]),
        work_end=_time_str(row["work_end"]),
        work_days=row["work_days"] or [],
        daily_caps=row["daily_caps"] or {},
        status=row["status"],
        assignments=assignments or [],
    )


def _assignments_for(ctx: RequestContext, rep_id: str) -> list[dict]:
    rows = ctx.conn.execute(
        "select rc.campaign_id, c.name as campaign_name, rc.use_rep_identity "
        "from rep_campaigns rc join campaigns c on c.id = rc.campaign_id "
        "where rc.org_id = %s and rc.rep_id = %s",
        (ctx.org_id, rep_id),
    ).fetchall()
    return [
        {
            "campaign_id": str(r["campaign_id"]),
            "campaign_name": r["campaign_name"],
            "use_rep_identity": r["use_rep_identity"],
        }
        for r in rows
    ]


@router.get("/reps", response_model=list[RepResponse])
def list_reps(ctx: RequestContext = Depends(get_ctx)) -> list[RepResponse]:
    rows = ctx.repo.list("reps", order_by="name")
    return [_to_response(row, _assignments_for(ctx, row["id"])) for row in rows]


class RepCreateRequest(BaseModel):
    name: str
    email: str | None = None
    timezone: str | None = None
    signature: str | None = None
    work_start: str | None = None  # "HH:MM"
    work_end: str | None = None
    work_days: list[int] = Field(default_factory=list)
    daily_caps: dict[str, int] = Field(default_factory=dict)


@router.post("/reps", response_model=RepResponse, status_code=201)
def create_rep(body: RepCreateRequest, ctx: RequestContext = Depends(get_ctx)) -> RepResponse:
    data = body.model_dump()
    data["daily_caps"] = Jsonb(data["daily_caps"])
    row = ctx.repo.insert("reps", data)
    return _to_response(row)


class RepUpdateRequest(BaseModel):
    name: str | None = None
    email: str | None = None
    timezone: str | None = None
    signature: str | None = None
    work_start: str | None = None
    work_end: str | None = None
    work_days: list[int] | None = None
    daily_caps: dict[str, int] | None = None
    status: str | None = None


@router.patch("/reps/{rep_id}", response_model=RepResponse)
def update_rep(
    rep_id: str, body: RepUpdateRequest, ctx: RequestContext = Depends(get_ctx)
) -> RepResponse:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if "daily_caps" in updates:
        updates["daily_caps"] = Jsonb(updates["daily_caps"])
    row = ctx.repo.update("reps", rep_id, updates) if updates else ctx.repo.get("reps", rep_id)
    return _to_response(row, _assignments_for(ctx, rep_id))


@router.get("/reps/{rep_id}/assignments", response_model=list[dict])
def get_rep_assignments(rep_id: str, ctx: RequestContext = Depends(get_ctx)) -> list[dict]:
    ctx.repo.get("reps", rep_id)  # 404 if not this org's rep
    return _assignments_for(ctx, rep_id)


class OffboardReassignment(BaseModel):
    campaign_id: str
    new_rep_id: str | None = None  # None = leave that campaign unassigned


class OffboardRequest(BaseModel):
    reassignments: list[OffboardReassignment] = Field(default_factory=list)


class OffboardResponse(BaseModel):
    rep: RepResponse
    affected_campaigns: list[dict]


@router.post("/reps/{rep_id}/offboard", response_model=OffboardResponse)
def offboard_rep(
    rep_id: str, body: OffboardRequest, ctx: RequestContext = Depends(get_ctx)
) -> OffboardResponse:
    ctx.repo.get("reps", rep_id)  # 404 if not this org's rep
    affected = _assignments_for(ctx, rep_id)

    for item in body.reassignments:
        ctx.conn.execute(
            "delete from rep_campaigns where org_id = %s and rep_id = %s and campaign_id = %s",
            (ctx.org_id, rep_id, item.campaign_id),
        )
        if item.new_rep_id is not None:
            ctx.repo.get("reps", item.new_rep_id)  # 404 if the replacement isn't this org's rep
            ctx.repo.insert(
                "rep_campaigns",
                {"rep_id": item.new_rep_id, "campaign_id": item.campaign_id},
            )

    row = ctx.repo.update("reps", rep_id, {"status": "offboarded"})
    return OffboardResponse(rep=_to_response(row), affected_campaigns=affected)


class ReassignRequest(BaseModel):
    campaign_id: str
    from_rep_id: str
    to_rep_id: str | None = None  # None = unassign only


@router.post("/reps/reassign", status_code=204)
def reassign_rep(body: ReassignRequest, ctx: RequestContext = Depends(get_ctx)) -> None:
    ctx.repo.get("reps", body.from_rep_id)  # 404 if not this org's rep
    ctx.conn.execute(
        "delete from rep_campaigns where org_id = %s and rep_id = %s and campaign_id = %s",
        (ctx.org_id, body.from_rep_id, body.campaign_id),
    )
    if body.to_rep_id is not None:
        ctx.repo.get("reps", body.to_rep_id)
        ctx.repo.insert(
            "rep_campaigns", {"rep_id": body.to_rep_id, "campaign_id": body.campaign_id}
        )


class AssignRepRequest(BaseModel):
    rep_id: str
    use_rep_identity: bool = True


@router.post("/campaigns/{campaign_id}/reps", status_code=201)
def assign_rep_to_campaign(
    campaign_id: str, body: AssignRepRequest, ctx: RequestContext = Depends(get_ctx)
) -> dict:
    ctx.repo.get("campaigns", campaign_id)  # 404s if either side isn't this org's
    ctx.repo.get("reps", body.rep_id)
    row = ctx.repo.insert(
        "rep_campaigns",
        {
            "rep_id": body.rep_id,
            "campaign_id": campaign_id,
            "use_rep_identity": body.use_rep_identity,
        },
    )
    return {
        "campaign_id": str(row["campaign_id"]),
        "rep_id": str(row["rep_id"]),
        "use_rep_identity": row["use_rep_identity"],
    }


@router.delete("/campaigns/{campaign_id}/reps/{rep_id}", status_code=204)
def unassign_rep_from_campaign(
    campaign_id: str, rep_id: str, ctx: RequestContext = Depends(get_ctx)
) -> None:
    cursor = ctx.conn.execute(
        "delete from rep_campaigns where org_id = %s and campaign_id = %s and rep_id = %s",
        (ctx.org_id, campaign_id, rep_id),
    )
    if cursor.rowcount == 0:
        raise api_error(404, "not_found", "Rep is not assigned to this campaign")
