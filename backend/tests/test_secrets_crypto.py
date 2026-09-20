"""AES-GCM secret encryption (backend/tenancy/crypto.py). No database needed."""

from __future__ import annotations

import pytest
from cryptography.exceptions import InvalidTag

from tenancy.crypto import decrypt_secret, encrypt_secret, generate_secrets_key


def test_round_trip():
    plaintext = "smtp-app-password-abc123"
    blob = encrypt_secret(plaintext)
    assert decrypt_secret(blob) == plaintext


def test_ciphertext_never_contains_the_plaintext():
    plaintext = "smtp-app-password-abc123"
    blob = encrypt_secret(plaintext)
    assert plaintext.encode() not in blob


def test_two_encryptions_of_the_same_secret_differ():
    # a fresh random nonce every call, so identical plaintexts never produce identical
    # ciphertext (defends against pattern-matching across tenants' stored secrets).
    plaintext = "same-value-both-times"
    assert encrypt_secret(plaintext) != encrypt_secret(plaintext)


def test_tampered_ciphertext_fails_to_decrypt():
    blob = bytearray(encrypt_secret("a-secret-value"))
    blob[-1] ^= 0xFF  # flip a bit in the auth tag
    with pytest.raises(InvalidTag):
        decrypt_secret(bytes(blob))


def test_generate_secrets_key_is_32_bytes_base64():
    import base64

    key = generate_secrets_key()
    assert len(base64.b64decode(key)) == 32
