"""API-level tests for inbound webhooks (spec sections 9-11). Only the WhatsApp tests
go through `orchestrator.inbound`'s retrieval step, which needs pgvector; on a machine
without it (see conftest.py) those two skip, same as the KB test in
test_tenant_isolation.py — they run for real against Supabase. The voice tests don't
touch retrieval and always run.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ai import llm
from db.connection import org_connection
from db.repository import OrgScopedRepo
from main import app


class _FakeChatCompletions:
    def __init__(self, replies: list) -> None:
        self._replies = list(replies)
        self.calls = 0

    def create(self, **kwargs) -> SimpleNamespace:
        self.calls += 1
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


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


def _connect_whatsapp_and_add_prospect(client: TestClient, org_id: str) -> tuple[str, dict]:
    integration = client.put("/integrations/twilio_whatsapp", json={"mode": "sandbox"}).json()
    token = integration["webhook_url"].rsplit("/", 1)[-1]

    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        campaign = repo.insert("campaigns", {"name": "Q4", "status": "live"})
        prospect = repo.insert("prospects", {"full_name": "Jordan", "phone": "+15551234567"})
        cp = repo.insert(
            "campaign_prospects",
            {"campaign_id": campaign["id"], "prospect_id": prospect["id"], "stage": "contacted"},
        )
    return token, cp


def test_whatsapp_webhook_matches_and_classifies_a_reply(monkeypatch, two_orgs, pg_server):
    if not pg_server["has_vector"]:
        pytest.skip("pgvector is not installed on this machine (needs root)")
    org_a, _org_b = two_orgs
    token, cp = _connect_whatsapp_and_add_prospect(_client(org_a), org_a.id)

    reply_json = (
        '{"intent": "interested", "sentiment": "positive", '
        '"needs_human": false, "reason": "r"}'
    )
    fake = _FakeClient([_response(reply_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    response = TestClient(app).post(
        f"/webhooks/whatsapp/{token}",
        data={"From": "whatsapp:+15551234567", "Body": "Sounds great!", "MessageSid": "SM123"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "received"

    with org_connection(org_a.id) as conn:
        updated_cp = OrgScopedRepo(conn, org_a.id).get("campaign_prospects", cp["id"])
    assert updated_cp["stage"] == "engaged"


def test_duplicate_webhook_delivery_is_ignored(monkeypatch, two_orgs, pg_server):
    if not pg_server["has_vector"]:
        pytest.skip("pgvector is not installed on this machine (needs root)")
    org_a, _org_b = two_orgs
    token, _cp = _connect_whatsapp_and_add_prospect(_client(org_a), org_a.id)

    reply_json = (
        '{"intent": "question", "sentiment": "neutral", '
        '"needs_human": false, "reason": "r"}'
    )
    fake = _FakeClient([_response(reply_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    webhook_client = TestClient(app)
    payload = {"From": "whatsapp:+15551234567", "Body": "hi", "MessageSid": "SM-dup"}
    first = webhook_client.post(f"/webhooks/whatsapp/{token}", data=payload)
    second = webhook_client.post(f"/webhooks/whatsapp/{token}", data=payload)

    assert first.json()["status"] == "received"
    assert second.json()["status"] == "duplicate_ignored"
    assert fake.chat.completions.calls == 1  # the model was never asked a second time


def test_unknown_webhook_token_is_404():
    response = TestClient(app).post(
        "/webhooks/whatsapp/not-a-real-token", data={"From": "x", "Body": "y"}
    )
    assert response.status_code == 404
    assert response.json()["code"] == "unknown_webhook_token"


def _connect_voice_and_add_prospect(client: TestClient, org_id: str) -> tuple[str, dict]:
    integration = client.put("/integrations/dronahq_voice", json={"mode": "sandbox"}).json()
    token = integration["webhook_url"].rsplit("/", 1)[-1]

    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        campaign = repo.insert("campaigns", {"name": "Q4", "status": "live"})
        prospect = repo.insert("prospects", {"full_name": "Jordan"})
        cp = repo.insert(
            "campaign_prospects",
            {"campaign_id": campaign["id"], "prospect_id": prospect["id"], "stage": "contacted"},
        )
    return token, cp


def test_voice_call_ended_extracts_outcome_and_advances_stage(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    token, cp = _connect_voice_and_add_prospect(client, org_a.id)

    extraction_json = (
        '{"transcript": "...", "outcome": "qualified", "qualified": true, '
        '"meeting_time": "2026-09-22T15:00:00Z", "objections": [], "next_step": "Send invite"}'
    )
    fake = _FakeClient([_response(extraction_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    response = client.post(
        f"/webhooks/voice/{token}",
        json={"event": "ended", "call_id": "CA1", "cp_id": str(cp["id"]), "transcript": "..."},
    )
    assert response.status_code == 200
    assert response.json()["outcome"] == "qualified"

    with org_connection(org_a.id) as conn:
        updated_cp = OrgScopedRepo(conn, org_a.id).get("campaign_prospects", cp["id"])
    assert updated_cp["stage"] == "meeting"


def test_voice_event_other_than_ended_is_ignored_without_error(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    token, _cp = _connect_voice_and_add_prospect(client, org_a.id)

    response = client.post(f"/webhooks/voice/{token}", json={"event": "answered", "call_id": "CA2"})
    assert response.status_code == 200
    assert response.json() == {"status": "ignored", "event": "answered"}


def test_voice_book_meeting_tool_records_a_meeting_touch(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)
    token, cp = _connect_voice_and_add_prospect(client, org_a.id)

    response = client.post(
        f"/webhooks/voice/{token}/tool",
        json={"cp_id": str(cp["id"]), "meeting_time": "2026-09-22T15:00:00Z"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "booked"

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        updated_cp = repo.get("campaign_prospects", cp["id"])
        touches = repo.list("touches", filters={"cp_id": cp["id"], "kind": "meeting"})
    assert updated_cp["stage"] == "meeting"
    assert len(touches) == 1
