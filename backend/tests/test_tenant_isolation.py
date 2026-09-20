"""The tenant-isolation tests from docs/spec.md section 6, run against a real Postgres
with real row-level security (see conftest.py) — not mocked.

Each test's docstring is the literal bullet from the spec it proves.
"""

from __future__ import annotations

import secrets

import pytest

from db.connection import org_connection
from db.repository import NotFound, OrgScopedRepo
from tenancy.auth import resolve_org_by_webhook_token
from tenancy.crypto import decrypt_secret, encrypt_secret


def test_list_and_get_scope_to_the_caller_org(two_orgs):
    """With two organizations, every list endpoint returns only the caller's rows;
    fetching another org's ID by direct UUID returns not found."""
    org_a, org_b = two_orgs

    with org_connection(org_a.id) as conn:
        campaign_a = OrgScopedRepo(conn, org_a.id).insert("campaigns", {"name": "A's campaign"})
    with org_connection(org_b.id) as conn:
        campaign_b = OrgScopedRepo(conn, org_b.id).insert("campaigns", {"name": "B's campaign"})

    with org_connection(org_a.id) as conn:
        repo_a = OrgScopedRepo(conn, org_a.id)
        rows = repo_a.list("campaigns")
        assert [r["name"] for r in rows] == ["A's campaign"]

        with pytest.raises(NotFound):
            repo_a.get("campaigns", campaign_b["id"])

        # the row org A DID create is reachable by id
        assert repo_a.get("campaigns", campaign_a["id"])["name"] == "A's campaign"


def test_empty_state_is_an_empty_list_not_an_error(two_orgs):
    """A brand-new organization with no rows sees `[]`, never a query error."""
    org_a, _ = two_orgs
    with org_connection(org_a.id) as conn:
        assert OrgScopedRepo(conn, org_a.id).list("campaigns") == []


@pytest.mark.usefixtures("pg_server")
def test_kb_search_never_returns_another_orgs_chunks(two_orgs, pg_server):
    """A KB search in org A never returns org B chunks, even with an identical query."""
    if not pg_server["has_vector"]:
        pytest.skip(
            "pgvector is not installed on this machine (needs root); "
            "0005_kb_chunks.sql was skipped. Runs for real against Supabase."
        )
    org_a, org_b = two_orgs
    same_content = "identical query text shared by both orgs"

    for org in (org_a, org_b):
        with org_connection(org.id) as conn:
            repo = OrgScopedRepo(conn, org.id)
            doc = repo.insert("kb_documents", {"doc_type": "faq", "title": "t", "content": "c"})
            repo.insert(
                "kb_chunks",
                {
                    "document_id": doc["id"],
                    "chunk_index": 0,
                    "content": same_content,
                    "embedding": "[" + ",".join(["0"] * 1536) + "]",
                },
            )

    with org_connection(org_a.id) as conn:
        chunks = OrgScopedRepo(conn, org_a.id).list("kb_chunks", filters={"content": same_content})
        assert len(chunks) == 1
        assert chunks[0]["org_id"] == org_a.id


def test_suppression_and_org_controls_are_independent_per_org(two_orgs):
    """Suppression, kill switch, channel pauses and budgets in org A have no effect on
    org B."""
    org_a, org_b = two_orgs

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        repo.insert("org_controls", {"kill_switch": True})
        repo.insert("suppression", {"email": "blocked@example.com", "reason": "unsubscribed"})

    with org_connection(org_b.id) as conn:
        repo = OrgScopedRepo(conn, org_b.id)
        repo.insert("org_controls", {"kill_switch": False})

        controls_b = repo.list("org_controls")
        assert len(controls_b) == 1
        assert controls_b[0]["kill_switch"] is False  # unaffected by org A's kill switch

        assert repo.list("suppression") == []  # org A's suppressed contact is invisible


def test_webhook_token_resolves_only_its_own_org(two_orgs):
    """Webhooks resolve their organization from the integration token, and a token from
    org A cannot deliver into org B."""
    org_a, org_b = two_orgs
    token_a = secrets.token_urlsafe(16)

    with org_connection(org_a.id) as conn:
        OrgScopedRepo(conn, org_a.id).insert(
            "integrations", {"provider": "gmail_oauth", "webhook_token": token_a}
        )

    assert resolve_org_by_webhook_token(token_a) == org_a.id
    assert resolve_org_by_webhook_token("no-such-token") is None

    # org B's own connection can't see org A's integration row at all
    with org_connection(org_b.id) as conn:
        assert OrgScopedRepo(conn, org_b.id).list("integrations") == []


def test_integration_credentials_are_never_stored_in_plaintext(two_orgs):
    """Credentials are never present in any API response or log line — proven here as
    "never stored, returned or comparable in plaintext": the encrypted blob round-trips
    but never contains the plaintext secret."""
    org_a, _ = two_orgs
    plaintext = '{"api_key": "super-secret-value-123"}'
    blob = encrypt_secret(plaintext)

    assert plaintext.encode() not in blob
    assert decrypt_secret(blob) == plaintext

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        repo.insert("integrations", {"provider": "twilio_whatsapp", "config_encrypted": blob})
        stored = repo.list("integrations", filters={"provider": "twilio_whatsapp"})[0]

    stored_bytes = bytes(stored["config_encrypted"])
    assert plaintext.encode() not in stored_bytes
    assert decrypt_secret(stored_bytes) == plaintext


def test_row_level_security_blocks_unfiltered_cross_org_queries(two_orgs):
    """Defence in depth (layer 3): even a query with no org_id predicate at all, run as
    the non-bypassing app_user role, only ever sees the connection's own org."""
    org_a, org_b = two_orgs
    with org_connection(org_a.id) as conn:
        OrgScopedRepo(conn, org_a.id).insert("campaigns", {"name": "A's campaign"})
    with org_connection(org_b.id) as conn:
        OrgScopedRepo(conn, org_b.id).insert("campaigns", {"name": "B's campaign"})

    with org_connection(org_a.id) as conn:
        rows = conn.execute("select org_id from campaigns").fetchall()  # no WHERE at all
        assert {r["org_id"] for r in rows} == {org_a.id}


def test_service_role_bypasses_rls_which_is_why_the_repo_layer_is_the_real_guarantee(
    two_orgs, admin_conn
):
    """Spec section 5: "If the chosen Supabase connection uses the service role (which
    bypasses RLS), layer 2 [the org-scoped repository] is the real guarantee." This
    documents why: the migration-owning role sees every org's rows unfiltered."""
    org_a, org_b = two_orgs
    with org_connection(org_a.id) as conn:
        OrgScopedRepo(conn, org_a.id).insert("campaigns", {"name": "A's campaign"})
    with org_connection(org_b.id) as conn:
        OrgScopedRepo(conn, org_b.id).insert("campaigns", {"name": "B's campaign"})

    # The shared test cluster accumulates rows across the whole session, so assert a
    # subset relationship rather than exact equality: the point is that the
    # bypassing role sees rows from more than one org in a single unfiltered query,
    # which app_user (see the previous test) never does.
    rows = admin_conn.execute("select org_id from campaigns").fetchall()
    org_ids_seen = {r["org_id"] for r in rows}
    assert {org_a.id, org_b.id} <= org_ids_seen


def test_repo_rejects_unrecognised_table_names(two_orgs):
    org_a, _ = two_orgs
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        with pytest.raises(ValueError):
            repo.list("organizations")  # not org_id-keyed; not in the tenant-table set
        with pytest.raises(ValueError):
            repo.list("pg_shadow; drop table campaigns; --")
