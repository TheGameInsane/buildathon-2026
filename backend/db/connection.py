"""Runtime (non-migration) database connections.

The app and worker always connect as `app_user` — a role created in
0001_extensions_and_roles.sql that does NOT bypass row-level security — never as the
role that ran the migrations. See docs/spec.md section 5, enforcement layer 3.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import JsonbBinaryDumper


def app_database_url() -> str:
    return os.environ.get("APP_DATABASE_URL") or os.environ["DATABASE_URL"]

def _configure(conn: psycopg.Connection) -> psycopg.Connection:
    """psycopg has no default adapter for a plain Python `dict` — without this, every
    write to a `jsonb` column (agent_runs.input/output, campaign_prospects.research,
    campaigns.icp, ...) raises `cannot adapt type 'dict'`. Registering it here, once,
    for every connection this module creates, means callers never need to remember to
    wrap a dict in `psycopg.types.json.Jsonb(...)` themselves. Only `dict` is
    registered — `list` is left alone, since plain Python lists are how psycopg already
    adapts real Postgres arrays (`uuid[]`, `text[]`, `int[]`), and overriding that would
    break every array column instead."""
    conn.adapters.register_dumper(dict, JsonbBinaryDumper)
    return conn


@contextmanager
def app_connection() -> Iterator[psycopg.Connection]:
    """A connection with no org context set yet. Only for the two operations that must
    run before an org is known: resolving org_id from an API key or a webhook token
    (both go through a SECURITY DEFINER function, so RLS not being scoped yet is safe —
    see backend/tenancy/auth.py)."""
    with psycopg.connect(app_database_url(), row_factory=dict_row) as conn:
        yield _configure(conn)


@contextmanager
def org_connection(org_id: str) -> Iterator[psycopg.Connection]:
    """A connection scoped to one organization for the lifetime of one transaction.

    Sets the `app.org_id` GUC that every RLS policy reads, via `set_config(..., true)`
    (the `true` makes it transaction-local — it never leaks to another request even on
    a pooled connection). Callers should do their work and let the `with` block commit;
    an exception rolls the transaction back.
    """
    with psycopg.connect(app_database_url(), row_factory=dict_row) as conn:
        _configure(conn)
        with conn.transaction():
            conn.execute("select set_config('app.org_id', %s, true)", (str(org_id),))
            yield conn
