"""Org context, auth (api keys, roles), scoped repositories, secrets encryption.

See `auth.py` (API-key auth, `OrgContext`), `api_keys.py` (issuance/hashing) and
`crypto.py` (AES-GCM for `integrations.config_encrypted`). The org-scoped repository
helper itself lives in `backend/db/repository.py` since it is the database layer's
enforcement, not the auth layer's.
"""
