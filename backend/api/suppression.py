"""Suppression list CRUD (spec sections 7 and 10). Rows here are otherwise only ever
written by the inbound pipeline (`orchestrator.inbound`, on an unsubscribe reply) and
read by `orchestrator.policy_gate.check_gate` (do-not-contact check) - this is the
direct API to list, add, or remove one by hand."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx
from api.errors import api_error

router = APIRouter(tags=["suppression"])


class SuppressionResponse(BaseModel):
    id: str
    email: str | None
    phone: str | None
    linkedin_url: str | None
    reason: str | None
    created_at: str


def _to_response(row: dict) -> SuppressionResponse:
    return SuppressionResponse(
        id=str(row["id"]),
        email=row["email"],
        phone=row["phone"],
        linkedin_url=row["linkedin_url"],
        reason=row["reason"],
        created_at=row["created_at"].isoformat(),
    )


@router.get("/suppression", response_model=list[SuppressionResponse])
def list_suppression(ctx: RequestContext = Depends(get_ctx)) -> list[SuppressionResponse]:
    rows = ctx.repo.list("suppression", order_by="created_at")
    return [_to_response(row) for row in rows]


class SuppressionCreateRequest(BaseModel):
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    reason: str | None = None


@router.post("/suppression", response_model=SuppressionResponse, status_code=201)
def create_suppression(
    body: SuppressionCreateRequest, ctx: RequestContext = Depends(get_ctx)
) -> SuppressionResponse:
    if not (body.email or body.phone or body.linkedin_url):
        raise api_error(
            400, "missing_identifier", "One of email, phone or linkedin_url is required"
        )
    row = ctx.repo.insert("suppression", body.model_dump())
    return _to_response(row)


@router.delete("/suppression/{suppression_id}", status_code=204)
def delete_suppression(suppression_id: str, ctx: RequestContext = Depends(get_ctx)) -> None:
    ctx.repo.delete("suppression", suppression_id)
