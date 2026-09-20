"""Organization self-service routes (spec section 10): the org's own view of itself,
and its company profile (spec section 5's onboarding step 2 — prompts are rendered
from this for every campaign)."""

from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends
from psycopg.types.json import Jsonb
from pydantic import BaseModel, EmailStr

from api.deps import RequestContext, get_ctx
from api.errors import api_error

router = APIRouter(tags=["org"])


class OrgResponse(BaseModel):
    id: str
    name: str
    slug: str
    status: str
    monthly_budget_usd: float | None
    global_contact_cap_7d: int | None


def _get_org_row(ctx: RequestContext) -> dict:
    return ctx.conn.execute(
        "select id, name, slug, status, monthly_budget_usd, global_contact_cap_7d "
        "from organizations where id = %s",
        (ctx.org_id,),
    ).fetchone()


@router.get("/org", response_model=OrgResponse)
def get_org(ctx: RequestContext = Depends(get_ctx)) -> OrgResponse:
    row = _get_org_row(ctx)
    return OrgResponse(**{**row, "id": str(row["id"])})


class UpdateOrgRequest(BaseModel):
    name: str | None = None


@router.patch("/org", response_model=OrgResponse)
def update_org(body: UpdateOrgRequest, ctx: RequestContext = Depends(get_ctx)) -> OrgResponse:
    # status and monthly_budget_usd are platform-admin-only (see api/platform.py) - a
    # tenant cannot raise its own budget cap or un-suspend itself.
    if body.name is not None:
        ctx.conn.execute(
            "update organizations set name = %s where id = %s", (body.name, ctx.org_id)
        )
    row = _get_org_row(ctx)
    return OrgResponse(**{**row, "id": str(row["id"])})


class CompanyProfileRequest(BaseModel):
    company_name: str
    website: str | None = None
    one_liner: str | None = None
    description: str | None = None
    products: list[dict] = []
    value_props: list[str] = []
    default_tone: str | None = None
    brand_voice: str | None = None
    languages: list[str] = []
    sender_footer: str | None = None
    unsubscribe_text: str | None = None
    disclaimer: str | None = None


@router.get("/org/company-profile", response_model=CompanyProfileRequest | None)
def get_company_profile(ctx: RequestContext = Depends(get_ctx)) -> CompanyProfileRequest | None:
    rows = ctx.repo.list("company_profiles")
    return rows[0] if rows else None


@router.put("/org/company-profile", response_model=CompanyProfileRequest)
def put_company_profile(
    body: CompanyProfileRequest, ctx: RequestContext = Depends(get_ctx)
) -> CompanyProfileRequest:
    data = body.model_dump()
    # `products` is a JSON array stored in a jsonb column; psycopg's default `list`
    # adapter targets a native Postgres array instead, so it needs an explicit Jsonb()
    # wrap. `value_props`/`languages` are real `text[]` columns and stay plain lists.
    data["products"] = Jsonb(data["products"])

    if ctx.repo.list("company_profiles"):
        set_clause = ", ".join(f"{col} = %({col})s" for col in data)  # our own field names
        ctx.conn.execute(
            f"update company_profiles set {set_clause} where org_id = %(org_id)s",  # noqa: S608
            {**data, "org_id": ctx.org_id},
        )
    else:
        ctx.repo.insert("company_profiles", data)
    return body


# ---------------------------------------------------------------------------
# Org members (spec section 10). `org_members.password_hash` is a credential and is
# never selected here or put on a response model - login/registration (api/auth.py)
# are the only things that ever touch it.
# ---------------------------------------------------------------------------

_MEMBER_ROLES = {"admin", "manager", "rep", "viewer"}
_MEMBER_COLUMNS = "id, user_ref, name, email, role"


class MemberResponse(BaseModel):
    id: str
    user_ref: str
    name: str | None
    email: str | None
    role: str


def _to_member(row: dict) -> MemberResponse:
    return MemberResponse(**{**row, "id": str(row["id"])})


@router.get("/org/members", response_model=list[MemberResponse])
def list_members(ctx: RequestContext = Depends(get_ctx)) -> list[MemberResponse]:
    rows = ctx.conn.execute(
        f"select {_MEMBER_COLUMNS} from org_members where org_id = %s order by name",  # noqa: S608
        (ctx.org_id,),
    ).fetchall()
    return [_to_member(row) for row in rows]


class MemberCreateRequest(BaseModel):
    name: str
    email: EmailStr
    role: str


@router.post("/org/members", response_model=MemberResponse, status_code=201)
def create_member(
    body: MemberCreateRequest, ctx: RequestContext = Depends(get_ctx)
) -> MemberResponse:
    if body.role not in _MEMBER_ROLES:
        raise api_error(400, "invalid_role", f"role must be one of {sorted(_MEMBER_ROLES)}")
    try:
        row = ctx.repo.insert(
            "org_members",
            {"user_ref": body.email, "name": body.name, "email": body.email, "role": body.role},
        )
    except psycopg.errors.UniqueViolation as exc:
        raise api_error(409, "email_taken", "A member with this email already exists") from exc
    return _to_member(row)


class MemberUpdateRequest(BaseModel):
    name: str | None = None
    role: str | None = None


@router.patch("/org/members/{member_id}", response_model=MemberResponse)
def update_member(
    member_id: str, body: MemberUpdateRequest, ctx: RequestContext = Depends(get_ctx)
) -> MemberResponse:
    if body.role is not None and body.role not in _MEMBER_ROLES:
        raise api_error(400, "invalid_role", f"role must be one of {sorted(_MEMBER_ROLES)}")
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    row = (
        ctx.repo.update("org_members", member_id, updates)
        if updates
        else ctx.repo.get("org_members", member_id)
    )
    return _to_member(row)


@router.delete("/org/members/{member_id}", status_code=204)
def delete_member(member_id: str, ctx: RequestContext = Depends(get_ctx)) -> None:
    ctx.repo.delete("org_members", member_id)
