"""Secrets at rest: AES-256-GCM, keyed by the `SECRETS_KEY` env var (never in code, never
logged). Every integration credential (`integrations.config_encrypted`) is encrypted
with this module before it touches the database and decrypted only inside the channel
adapter that needs it — never returned by any API, never logged.
"""

from __future__ import annotations

import base64
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_LEN = 12  # bytes; standard for AES-GCM


def _key() -> bytes:
    raw = os.environ.get("SECRETS_KEY")
    if not raw:
        raise RuntimeError("SECRETS_KEY is not set")
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise ValueError("SECRETS_KEY must base64-decode to exactly 32 bytes (AES-256-GCM)")
    return key


def generate_secrets_key() -> str:
    """Generates a fresh base64-encoded 32-byte key, for `.env` — never for use inside
    the running process itself."""
    return base64.b64encode(secrets.token_bytes(32)).decode("ascii")


def encrypt_secret(plaintext: str) -> bytes:
    """Returns `nonce || ciphertext_with_tag`, ready to store in a `bytea` column."""
    aesgcm = AESGCM(_key())
    nonce = secrets.token_bytes(_NONCE_LEN)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ciphertext


def decrypt_secret(blob: bytes) -> str:
    aesgcm = AESGCM(_key())
    nonce, ciphertext = blob[:_NONCE_LEN], blob[_NONCE_LEN:]
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")
