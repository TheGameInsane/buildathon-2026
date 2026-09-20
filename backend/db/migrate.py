"""Plain-SQL migration runner. No ORM, no migration framework: apply each file in
`backend/db/migrations/` once, in filename order, tracked in `schema_migrations`.

Run migrations with a role that owns the schema (creates extensions, roles, RLS
policies) — on Supabase that's the default `postgres` connection string. The app and
worker connect separately, at runtime, as `app_user` (see backend/db/connection.py).
"""

from __future__ import annotations

import os
from collections.abc import Iterable
from pathlib import Path

import psycopg

MIGRATIONS_DIR = Path(__file__).parent / "migrations"


def migrations_database_url() -> str:
    return os.environ.get("MIGRATIONS_DATABASE_URL") or os.environ["DATABASE_URL"]


def _ensure_tracking_table(conn: psycopg.Connection) -> None:
    conn.execute(
        "create table if not exists schema_migrations "
        "(filename text primary key, applied_at timestamptz not null default now())"
    )


def _applied(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute("select filename from schema_migrations").fetchall()
    return {row[0] for row in rows}


def pending_migrations(conn: psycopg.Connection, *, skip: Iterable[str] = ()) -> list[Path]:
    _ensure_tracking_table(conn)
    done = _applied(conn)
    skip_set = set(skip)
    return [
        f
        for f in sorted(MIGRATIONS_DIR.glob("*.sql"))
        if f.name not in done and f.name not in skip_set
    ]


def apply_migrations(conn: psycopg.Connection, *, skip: Iterable[str] = ()) -> list[str]:
    """Apply every pending migration not in `skip`, each in its own transaction.

    `skip` exists for one reason: a local dev Postgres without the `vector` extension
    installed can't run 0005_kb_chunks.sql. Production (Supabase) always has pgvector,
    so nothing is ever skipped there.
    """
    applied: list[str] = []
    for path in pending_migrations(conn, skip=skip):
        sql = path.read_text()
        with conn.transaction():
            conn.execute(sql)
            conn.execute(
                "insert into schema_migrations (filename) values (%s)", (path.name,)
            )
        applied.append(path.name)
    return applied


def main() -> None:
    with psycopg.connect(migrations_database_url(), autocommit=True) as conn:
        applied = apply_migrations(conn)
    if applied:
        print("Applied:")
        for name in applied:
            print(f"  {name}")
    else:
        print("Nothing to apply — schema is up to date.")


if __name__ == "__main__":
    main()
