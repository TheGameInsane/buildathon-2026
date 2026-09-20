"""API-key auth (spec section 5, enforcement layer 1): every request carries an
org-scoped API key in `Authorization: Bearer ...` that resolves `org_id`. `org_id` is
never accepted from a client-supplied field — it only ever comes from here.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Header, HTTPException

from db.connection import app_connection
from tenancy.api_keys import resolve_api_key


def _api_error(message: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={"code": "unauthorized", "message": message, "details": {}},
    )


@dataclass
class OrgContext:
    org_id: str
    api_key_id: str


def _extract_bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _api_error("Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise _api_error("Missing or malformed Authorization header")
    return token


def require_org(authorization: str | None = Header(default=None)) -> OrgContext:
    """FastAPI dependency for tenant routes: resolves the caller's `org_id`. Rejects a
    platform-admin key (its `org_id` is null) — use `require_platform_admin` instead."""
    raw_key = _extract_bearer(authorization)
    with app_connection() as conn:
        resolved = resolve_api_key(conn, raw_key)
    if resolved is None or resolved.org_id is None:
        raise _api_error("Invalid or revoked API key")
    return OrgContext(org_id=resolved.org_id, api_key_id=resolved.id)


def require_platform_admin(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency for `/platform/*` routes: only a platform-admin key (`org_id`
    null) is accepted. Returns the api_key id."""
    raw_key = _extract_bearer(authorization)
    with app_connection() as conn:
        resolved = resolve_api_key(conn, raw_key)
    if resolved is None or resolved.org_id is not None:
        raise _api_error("Invalid or revoked platform admin key")
    return resolved.id


def resolve_org_by_webhook_token(token: str) -> str | None:
    """Resolves `org_id` from an inbound webhook's opaque integration token
    (`/webhooks/{provider}/{integration_token}`). Returns `None` for an unknown token —
    callers must treat that as 404, never fall back to any default organization."""
    with app_connection() as conn:
        row = conn.execute(
            "select resolve_org_by_webhook_token(%s) as org_id", (token,)
        ).fetchone()
    return row["org_id"] if row else None
