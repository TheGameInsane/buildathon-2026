"""Platform-admin routes (spec section 10): creating organizations and the platform-
wide kill switch. Locked behind `require_platform_admin` — never reachable with a
tenant's own key.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from db.connection import app_connection
from tenancy.api_keys import generate_key, hash_key
from tenancy.auth import require_platform_admin

router = APIRouter(prefix="/platform", tags=["platform"])


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    admin_user_ref: str = Field(description="the DronaHQ user id to make this org's first admin")


class CreateOrgResponse(BaseModel):
    org_id: str
    api_key: str  # returned once - only its hash is ever stored, never retrievable again


@router.post("/orgs", response_model=CreateOrgResponse, status_code=201)
def create_org(
    body: CreateOrgRequest, _admin_key_id: str = Depends(require_platform_admin)
) -> CreateOrgResponse:
    raw_key = generate_key()
    with app_connection() as conn:
        # Creating the org, its first admin member and its first API key must all
        # happen before any app.org_id context exists, so they go through one
        # SECURITY DEFINER function (db/migrations/0010) - the same fix as
        # resolve_api_key for the identical chicken-and-egg problem.
        row = conn.execute(
            "select * from create_organization(%s, %s, %s, %s)",
            (body.name, body.slug, body.admin_user_ref, hash_key(raw_key)),
        ).fetchone()
    return CreateOrgResponse(org_id=str(row["id"]), api_key=raw_key)


class OrgSummary(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    monthly_budget_usd: float | None


_ORG_SUMMARY_COLUMNS = ("name", "slug", "status", "monthly_budget_usd")


def _to_org_summary(row: dict) -> OrgSummary:
    return OrgSummary(id=str(row["id"]), **{col: row[col] for col in _ORG_SUMMARY_COLUMNS})


@router.get("/orgs", response_model=list[OrgSummary])
def list_orgs(_admin_key_id: str = Depends(require_platform_admin)) -> list[OrgSummary]:
    with app_connection() as conn:
        rows = conn.execute(
            "select id, name, slug, status, monthly_budget_usd "
            "from organizations order by created_at"
        ).fetchall()
    return [_to_org_summary(row) for row in rows]


class UpdateOrgRequest(BaseModel):
    status: str | None = None
    monthly_budget_usd: float | None = None


@router.patch("/orgs/{org_id}", response_model=OrgSummary)
def update_org(
    org_id: str, body: UpdateOrgRequest, _admin_key_id: str = Depends(require_platform_admin)
) -> OrgSummary:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    with app_connection() as conn:
        if updates:
            # column names come from our own field names, never user input
            set_clause = ", ".join(f"{col} = %({col})s" for col in updates)
            conn.execute(
                f"update organizations set {set_clause} where id = %(org_id)s",  # noqa: S608
                {**updates, "org_id": org_id},
            )
        row = conn.execute(
            "select id, name, slug, status, monthly_budget_usd from organizations where id = %s",
            (org_id,),
        ).fetchone()
    return _to_org_summary(row)


class KillSwitchRequest(BaseModel):
    on: bool


@router.post("/kill-switch")
def set_platform_kill_switch(
    body: KillSwitchRequest, admin_key_id: str = Depends(require_platform_admin)
) -> dict:
    with app_connection() as conn:
        conn.execute(
            "insert into platform_controls (id, kill_switch, updated_by) values (1, %s, %s) "
            "on conflict (id) do update set kill_switch = %s, updated_by = %s, updated_at = now()",
            (body.on, admin_key_id, body.on, admin_key_id),
        )
    return {"kill_switch": body.on}
