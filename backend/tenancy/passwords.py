"""Password hashing for self-serve tenant registration/login (spec section 5), kept
separate from `tenancy/api_keys.py` — a password authenticates a human at login time;
an API key authenticates a client on every request afterward. PBKDF2-HMAC-SHA256,
stdlib only (no new dependency for one hash function): salted per password, a fixed
high iteration count, and constant-time comparison on verify. A plaintext password is
never stored or logged, matching CLAUDE.md's credential rule.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import os

_ALGORITHM = "pbkdf2_sha256"
_ITERATIONS = 200_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    """Returns `algorithm$iterations$salt_b64$hash_b64` — self-describing, so the
    iteration count can be raised later without invalidating already-stored hashes."""
    salt = os.urandom(_SALT_BYTES)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return (
        f"{_ALGORITHM}${_ITERATIONS}$"
        f"{base64.b64encode(salt).decode()}${base64.b64encode(derived).decode()}"
    )


def verify_password(password: str, stored: str) -> bool:
    """Never raises on a malformed `stored` value (e.g. a stale format) — treats it as
    a non-match rather than a 500."""
    try:
        algorithm, iterations_str, salt_b64, hash_b64 = stored.split("$")
        if algorithm != _ALGORITHM:
            return False
        iterations = int(iterations_str)
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
    except (ValueError, TypeError):
        return False
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(derived, expected)
