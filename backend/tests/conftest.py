"""Shared fixtures for the tenancy/db tests.

These are integration tests: they need a real Postgres to prove row-level security
actually blocks cross-tenant reads, not a mock of one. Rather than depend on Docker or
a pre-existing server, this spins up a private, throwaway Postgres cluster for the test
session using the `initdb`/`pg_ctl`/`postgres` binaries already required to run
Postgres locally at all — no root, no extra service. It is torn down at the end of the
session regardless of outcome.

The one thing this sandboxed cluster cannot have is the `vector` extension unless it
happens to be installed system-wide (it usually isn't, outside of Supabase or a
purpose-built image) — installing it needs root. When it's missing, 0005_kb_chunks.sql
is skipped and the one test that needs it is skipped too, with a clear reason; every
other tenant-isolation test (which is most of them) still runs for real.
"""

from __future__ import annotations

import secrets
import shutil
import socket
import subprocess
import tempfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import psycopg
import pytest
from psycopg import sql
from psycopg.rows import dict_row

from db import migrate
from tenancy.api_keys import create_api_key
from tenancy.crypto import generate_secrets_key

_APP_USER_PASSWORD = secrets.token_urlsafe(24)


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _extension_available(dsn: str, name: str) -> bool:
    with psycopg.connect(dsn, autocommit=True) as conn:
        row = conn.execute(
            "select 1 from pg_available_extensions where name = %s", (name,)
        ).fetchone()
        return row is not None


@pytest.fixture(scope="session")
def pg_server() -> Iterator[dict]:
    if shutil.which("initdb") is None or shutil.which("pg_ctl") is None:
        pytest.skip("initdb/pg_ctl not on PATH — install the postgresql server binaries")

    data_dir = Path(tempfile.mkdtemp(prefix="sdr_test_pg_"))
    port = _free_port()
    log_path = data_dir / "log.txt"
    subprocess.run(
        ["initdb", "-D", str(data_dir), "-U", "postgres", "--auth=trust", "--no-sync"],
        check=True,
        capture_output=True,
        text=True,
    )
    subprocess.run(
        [
            "pg_ctl",
            "-D",
            str(data_dir),
            "-o",
            f"-p {port} -c unix_socket_directories='' -c listen_addresses=127.0.0.1",
            "-l",
            str(log_path),
            "-w",
            "start",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    try:
        bootstrap_dsn = f"host=127.0.0.1 port={port} user=postgres dbname=postgres"
        with psycopg.connect(bootstrap_dsn, autocommit=True) as conn:
            conn.execute("create database sdr_test")
        admin_dsn = f"host=127.0.0.1 port={port} user=postgres dbname=sdr_test"

        has_vector = _extension_available(admin_dsn, "vector")
        skip = () if has_vector else ("0005_kb_chunks.sql",)
        with psycopg.connect(admin_dsn, autocommit=True) as conn:
            migrate.apply_migrations(conn, skip=skip)
            conn.execute(
                sql.SQL("alter role app_user with password {}").format(
                    sql.Literal(_APP_USER_PASSWORD)
                )
            )

        app_dsn = (
            f"host=127.0.0.1 port={port} user=app_user "
            f"password={_APP_USER_PASSWORD} dbname=sdr_test"
        )
        yield {"admin_dsn": admin_dsn, "app_dsn": app_dsn, "has_vector": has_vector}
    finally:
        subprocess.run(
            ["pg_ctl", "-D", str(data_dir), "stop", "-m", "immediate"],
            capture_output=True,
            text=True,
        )
        shutil.rmtree(data_dir, ignore_errors=True)


@pytest.fixture(scope="session", autouse=True)
def configured_env(pg_server: dict) -> Iterator[None]:
    # The built-in `monkeypatch` fixture is function-scoped and can't be requested
    # here, so use the underlying `pytest.MonkeyPatch` class directly instead.
    mp = pytest.MonkeyPatch()
    mp.setenv("APP_DATABASE_URL", pg_server["app_dsn"])
    mp.setenv("DATABASE_URL", pg_server["admin_dsn"])
    mp.setenv("SECRETS_KEY", generate_secrets_key())
    yield
    mp.undo()


@pytest.fixture()
def admin_conn(pg_server: dict) -> Iterator[psycopg.Connection]:
    """A connection as the migration-owning role — bypasses RLS, used only to set up
    fixtures the way a platform-admin action would (e.g. creating an organization)."""
    with psycopg.connect(pg_server["admin_dsn"], row_factory=dict_row, autocommit=True) as conn:
        yield conn


@dataclass
class TestOrg:
    id: object  # uuid.UUID, as returned by psycopg — kept as-is so it compares equal
    api_key: str


def _make_org(conn: psycopg.Connection, name: str) -> TestOrg:
    slug = f"{name.lower().replace(' ', '-')}-{secrets.token_hex(4)}"
    row = conn.execute(
        "insert into organizations (name, slug) values (%s, %s) returning id",
        (name, slug),
    ).fetchone()
    org_id = row["id"]
    raw_key = create_api_key(conn, org_id=org_id, label="test key")
    return TestOrg(id=org_id, api_key=raw_key)


@pytest.fixture()
def two_orgs(admin_conn: psycopg.Connection) -> tuple[TestOrg, TestOrg]:
    return _make_org(admin_conn, "Org A"), _make_org(admin_conn, "Org B")
