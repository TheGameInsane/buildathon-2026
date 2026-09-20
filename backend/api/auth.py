"""Self-serve tenant registration and login (spec section 5's self-serve signup path).
Separate from `/platform/orgs` (platform-admin-provisioned orgs, api/platform.py) and
from org-scoped API keys (what every other route authenticates with) — this is how a
human creates a workspace and signs into it from the frontend with an email and
password, rather than being handed a bearer key out of band.

Both routes are intentionally public: registration must work with no existing
credential, and login is how a credential is obtained in the first place.
"""

from __future__ import annotations

import re

import psycopg
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr, Field

from api.errors import api_error
from db.connection import app_connection, org_connection
from tenancy.api_keys import create_api_key, generate_key, hash_key
from tenancy.passwords import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

_SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")
_MAX_SLUG_ATTEMPTS = 50


def _slugify(name: str) -> str:
    base = _SLUG_INVALID_CHARS.sub("-", name.strip().lower()).strip("-")
    return (base or "org")[:50]


class MemberSummary(BaseModel):
    name: str
    email: str
    role: str


class AuthResponse(BaseModel):
    org_id: str
    api_key: str  # returned once - only its hash is ever stored, never retrievable again
    member: MemberSummary


class RegisterRequest(BaseModel):
    company_name: str = Field(min_length=1, max_length=200)
    admin_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(body: RegisterRequest) -> AuthResponse:
    # No pre-check against org_members here: it has no org context yet, so its RLS
    # policy would silently return zero rows for any query regardless of what's
    # actually stored (the same bootstrap problem create_organization itself solves) -
    # the uniqueness check has to happen at the database's unique constraint instead.
    raw_key = generate_key()
    password_hash = hash_password(body.password)
    slug_base = _slugify(body.company_name)

    row = None
    for attempt in range(_MAX_SLUG_ATTEMPTS):
        slug = slug_base if attempt == 0 else f"{slug_base}-{attempt}"
        try:
            with app_connection() as conn:
                row = conn.execute(
                    "select * from create_organization(%s, %s, %s, %s, %s, %s, %s)",
                    (
                        body.company_name,
                        slug,
                        body.email,
                        hash_key(raw_key),
                        body.email,
                        password_hash,
                        body.admin_name,
                    ),
                ).fetchone()
            break
        except psycopg.errors.UniqueViolation as exc:
            constraint = getattr(exc.diag, "constraint_name", None) or ""
            if "email" in constraint:
                message = "An account with this email already exists"
                raise api_error(409, "email_taken", message) from exc
            continue  # a slug collision - retry with a numeric suffix
    if row is None:
        message = "Could not create a workspace - please try again"
        raise api_error(500, "registration_failed", message)

    return AuthResponse(
        org_id=str(row["id"]),
        api_key=raw_key,
        member=MemberSummary(name=body.admin_name, email=body.email, role="admin"),
    )


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    with app_connection() as conn:
        row = conn.execute("select * from resolve_member_by_email(%s)", (body.email,)).fetchone()

    if row is None or not verify_password(body.password, row["password_hash"]):
        raise api_error(401, "invalid_credentials", "Incorrect email or password")

    # A fresh key per login - api_keys.create_api_key never lets a raw key be read back
    # out after creation, so login can't just hand back whatever key registration issued.
    with org_connection(row["org_id"]) as conn:
        raw_key = create_api_key(conn, org_id=row["org_id"], label=f"login:{body.email}")

    member_name = row.get("name") or body.email
    return AuthResponse(
        org_id=str(row["org_id"]),
        api_key=raw_key,
        member=MemberSummary(name=member_name, email=body.email, role=row["role"]),
    )
