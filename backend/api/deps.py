"""Shared FastAPI dependency for every org-scoped route: resolves the caller's org
(tenancy.auth.require_org) and opens one org-scoped connection/transaction for the
lifetime of the request, so a route's several repository calls commit or roll back
together.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import psycopg
from fastapi import Depends, Header

from db.connection import org_connection
from db.repository import OrgScopedRepo
from tenancy.auth import OrgContext, require_org


@dataclass
class RequestContext:
    org_id: str
    api_key_id: str
    actor: str
    conn: psycopg.Connection
    repo: OrgScopedRepo


def get_ctx(
    org_ctx: OrgContext = Depends(require_org),
    x_actor: str | None = Header(default=None),
) -> Iterator[RequestContext]:
    with org_connection(org_ctx.org_id) as conn:
        yield RequestContext(
            org_id=org_ctx.org_id,
            api_key_id=org_ctx.api_key_id,
            actor=x_actor or "unknown",
            conn=conn,
            repo=OrgScopedRepo(conn, org_ctx.org_id),
        )
