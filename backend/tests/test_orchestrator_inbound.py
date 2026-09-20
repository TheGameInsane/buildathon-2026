"""orchestrator.inbound against a real Postgres, with the LLM faked."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from ai import llm
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.inbound import handle_inbound_reply


class _FakeChatCompletions:
    def __init__(self, replies: list) -> None:
        self._replies = list(replies)

    def create(self, **kwargs) -> SimpleNamespace:
        return self._replies.pop(0)


class _FakeEmbeddings:
    def create(
        self, *, model: str, input: list[str], dimensions: int | None = None
    ) -> SimpleNamespace:
        return SimpleNamespace(data=[SimpleNamespace(embedding=[0.0]) for _ in input])


class _FakeClient:
    def __init__(self, replies: list) -> None:
        self.chat = SimpleNamespace(completions=_FakeChatCompletions(replies))
        self.embeddings = _FakeEmbeddings()


def _response(content: str) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )


@pytest.fixture(autouse=True)
def _llm_env(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_SMALL", "gpt-4o-mini")
    monkeypatch.setenv("MODEL_STRONG", "gpt-4o")
    monkeypatch.setenv("EMBED_MODEL", "text-embedding-3-small")


@pytest.fixture(autouse=True)
def _require_vector(pg_server):
    # The inbound pipeline retrieves KB chunks (rag.retrieval), which needs kb_chunks
    # (0005_kb_chunks.sql) - skipped on a machine without pgvector installed, same as
    # the kb-related test in test_tenant_isolation.py. Runs for real against Supabase.
    if not pg_server["has_vector"]:
        pytest.skip("pgvector is not installed on this machine (needs root)")


def _setup(org_id) -> dict:
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        campaign = repo.insert("campaigns", {"name": "Q4", "status": "live"})
        prospect = repo.insert("prospects", {"full_name": "Jordan", "email": "jordan@acme.test"})
        return repo.insert(
            "campaign_prospects",
            {"campaign_id": campaign["id"], "prospect_id": prospect["id"], "stage": "contacted"},
        )


def test_matched_reply_runs_conversation_and_wakes_strategy(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    cp = _setup(org_a.id)
    reply_json = (
        '{"intent": "interested", "sentiment": "positive", '
        '"needs_human": false, "reason": "r"}'
    )
    fake = _FakeClient([_response(reply_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    result = handle_inbound_reply(
        org_a.id, channel="email", from_identifier="jordan@acme.test", text="Sounds interesting!"
    )

    assert result is not None
    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        updated_cp = repo.get("campaign_prospects", cp["id"])
        touches = repo.list("touches", filters={"cp_id": cp["id"]})
        agent_runs = repo.list("agent_runs", filters={"cp_id": cp["id"]})

    assert updated_cp["stage"] == "engaged"  # promoted from "contacted"
    assert updated_cp["next_action_at"] is not None
    assert len(touches) == 1
    assert touches[0]["direction"] == "inbound"
    assert touches[0]["agent_run_id"] == agent_runs[0]["id"]


def test_unmatched_reply_is_logged_not_dropped(two_orgs):
    org_a, _org_b = two_orgs
    result = handle_inbound_reply(
        org_a.id, channel="email", from_identifier="nobody@nowhere.test", text="hi"
    )
    assert result is None
    with org_connection(org_a.id) as conn:
        log = OrgScopedRepo(conn, org_a.id).list(
            "activity_log", filters={"action": "unmatched_inbound"}
        )
    assert len(log) == 1


def test_unsubscribe_phrase_suppresses_and_stops_regardless_of_model_intent(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    cp = _setup(org_a.id)
    # The model misclassifies this as "interested" - the deterministic phrase check
    # must still force suppression (same guarantee agents.conversation tests on its own).
    reply_json = (
        '{"intent": "interested", "sentiment": "neutral", '
        '"needs_human": false, "reason": "r"}'
    )
    fake = _FakeClient([_response(reply_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    handle_inbound_reply(
        org_a.id,
        channel="email",
        from_identifier="jordan@acme.test",
        text="please unsubscribe me, stop",
    )

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        updated_cp = repo.get("campaign_prospects", cp["id"])
        suppression = repo.list("suppression", filters={"email": "jordan@acme.test"})

    assert updated_cp["stage"] == "stopped"
    assert updated_cp["next_action_at"] is None
    assert len(suppression) == 1


