"""API-key auth: resolving org_id, rejecting bad/revoked/wrong-kind keys."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from db.connection import app_connection
from tenancy.api_keys import create_api_key, resolve_api_key
from tenancy.auth import require_org, require_platform_admin


def test_resolve_api_key_returns_the_owning_org(two_orgs):
    org_a, _ = two_orgs
    with app_connection() as conn:
        resolved = resolve_api_key(conn, org_a.api_key)
    assert resolved is not None
    assert resolved.org_id == org_a.id


def test_resolve_api_key_rejects_an_unknown_key():
    with app_connection() as conn:
        assert resolve_api_key(conn, "sdr_this-key-does-not-exist") is None


def test_resolve_api_key_rejects_a_revoked_key(two_orgs, admin_conn):
    org_a, _ = two_orgs
    with app_connection() as conn:
        resolved = resolve_api_key(conn, org_a.api_key)
    admin_conn.execute("update api_keys set revoked_at = now() where id = %s", (resolved.id,))

    with app_connection() as conn:
        assert resolve_api_key(conn, org_a.api_key) is None


def test_require_org_rejects_missing_or_malformed_header():
    with pytest.raises(HTTPException):
        require_org(None)
    with pytest.raises(HTTPException):
        require_org("Token not-a-bearer-value")


def test_require_org_resolves_the_org_context(two_orgs):
    org_a, _ = two_orgs
    ctx = require_org(f"Bearer {org_a.api_key}")
    assert ctx.org_id == org_a.id


def test_require_org_rejects_a_platform_admin_key(admin_conn):
    raw_platform_key = create_api_key(admin_conn, org_id=None, label="platform")
    with pytest.raises(HTTPException):
        require_org(f"Bearer {raw_platform_key}")


def test_require_platform_admin_rejects_a_tenant_key(two_orgs):
    org_a, _ = two_orgs
    with pytest.raises(HTTPException):
        require_platform_admin(f"Bearer {org_a.api_key}")


def test_require_platform_admin_accepts_a_platform_key(admin_conn):
    raw_platform_key = create_api_key(admin_conn, org_id=None, label="platform")
    key_id = require_platform_admin(f"Bearer {raw_platform_key}")
    assert key_id
