"""API-key issuance and resolution. A key is a credential: it is returned to the caller
exactly once, at creation, and only its SHA-256 hash is ever stored or compared —
`api_keys.key_hash` never round-trips back to plaintext.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass

import psycopg

_PREFIX = "sdr_"


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_key() -> str:
    return _PREFIX + secrets.token_urlsafe(32)


def create_api_key(conn: psycopg.Connection, *, org_id: str | None, label: str) -> str:
    """`org_id=None` creates a platform-admin key. Returns the raw key — store only its
    hash; the caller must show it to the user now, it cannot be recovered later."""
    raw_key = generate_key()
    conn.execute(
        "insert into api_keys (org_id, key_hash, label) values (%s, %s, %s)",
        (org_id, hash_key(raw_key), label),
    )
    return raw_key


def revoke_api_key(conn: psycopg.Connection, key_id: str) -> None:
    conn.execute("update api_keys set revoked_at = now() where id = %s", (key_id,))


@dataclass
class ResolvedKey:
    id: str
    org_id: str | None  # None => platform admin key


def resolve_api_key(conn: psycopg.Connection, raw_key: str) -> ResolvedKey | None:
    """Looks up a raw key by its hash through the `resolve_api_key` SQL function
    (SECURITY DEFINER — see 0002_tenancy.sql), which is the only thing allowed to read
    api_keys before an org context exists. Returns `None` for an unknown or revoked key."""
    row = conn.execute("select * from resolve_api_key(%s)", (hash_key(raw_key),)).fetchone()
    if row is None:
        return None
    return ResolvedKey(id=row["id"], org_id=row["org_id"])
