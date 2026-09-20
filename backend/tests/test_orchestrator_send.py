"""orchestrator.step's _execute_send actually calling channels/ for a live
integration — proving the wiring, not the sandbox fallback (every other step test
already exercises that implicitly, since none of them configure a live integration).
smtplib and retrieval are faked; nothing here touches a real network or pgvector.
"""

from __future__ import annotations

import json
import smtplib
from types import SimpleNamespace

import pytest

from ai import llm
from channels import email as channels_email
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator import step as step_module
from rag import retrieval
from tenancy.crypto import encrypt_secret


class _FakeChatCompletions:
    def __init__(self, replies: list) -> None:
        self._replies = list(replies)

    def create(self, **kwargs) -> SimpleNamespace:
        return self._replies.pop(0)


class _FakeClient:
    def __init__(self, replies: list) -> None:
        self.chat = SimpleNamespace(completions=_FakeChatCompletions(replies))


def _response(content: str) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
    )


class _FakeSMTP:
    sent: list = []

    def __init__(self, host, port, timeout=None) -> None:
        pass

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def starttls(self, context=None) -> None:
        pass

    def login(self, username, password) -> None:
        pass

    def send_message(self, message) -> None:
        type(self).sent.append(message)


_STRATEGY_SEND = (
    '{"action": "send", "channel": "email", "send_after_hours": 24, '
    '"intent": "intro", "reason": "r"}'
)
_PERSONALISATION = (
    '{"subject": "Hi", "body": "Hello from Acme", "facts_used": [], '
    '"kb_chunks_used": []}'
)
_GROUNDING_OK = '{"claims": [], "all_supported": true, "risky_topics": []}'


@pytest.fixture(autouse=True)
def _llm_env(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_SMALL", "gpt-4o-mini")
    monkeypatch.setenv("MODEL_STRONG", "gpt-4o")
    # This test is about channel dispatch, not retrieval; pgvector's own correctness
    # is covered separately (test_orchestrator_inbound.py etc.).
    monkeypatch.setattr(retrieval, "retrieve", lambda *a, **k: [])


@pytest.fixture(autouse=True)
def _reset_fake_smtp():
    _FakeSMTP.sent = []
    yield


def _setup_qualified_prospect(org_id: str, *, with_live_email: bool) -> dict:
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        campaign = repo.insert("campaigns", {"name": "Q4", "status": "live"})
        prospect = repo.insert("prospects", {"full_name": "Jordan", "email": "jordan@acme.test"})
        cp = repo.insert(
            "campaign_prospects",
            {"campaign_id": campaign["id"], "prospect_id": prospect["id"], "stage": "qualified"},
        )
        if with_live_email:
            config = json.dumps(
                {
                    "host": "smtp.test.com",
                    "port": 587,
                    "username": "bot@test.com",
                    "password": "secret",
                    "from_address": "bot@test.com",
                }
            )
            repo.insert(
                "integrations",
                {
                    "provider": "email_smtp_imap",
                    "mode": "live",
                    "config_encrypted": encrypt_secret(config),
                },
            )
    return cp


def test_live_email_integration_actually_sends(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    cp = _setup_qualified_prospect(org_a.id, with_live_email=True)
    monkeypatch.setattr(smtplib, "SMTP", _FakeSMTP)
    fake = _FakeClient(
        [_response(_STRATEGY_SEND), _response(_PERSONALISATION), _response(_GROUNDING_OK)]
    )
    monkeypatch.setattr(llm, "_client", lambda: fake)

    step_module.step(org_a.id, cp["id"])

    assert len(_FakeSMTP.sent) == 1
    assert _FakeSMTP.sent[0]["To"] == "jordan@acme.test"

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        touches = repo.list("touches", filters={"cp_id": cp["id"]})
        updated_cp = repo.get("campaign_prospects", cp["id"])

    assert len(touches) == 1
    assert touches[0]["status"] == "sent"
    assert touches[0]["provider_id"] is not None
    assert touches[0]["thread_key"] == touches[0]["provider_id"]
    assert updated_cp["stage"] == "contacted"


def test_send_failure_marks_touch_failed_and_backs_off_without_advancing(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    cp = _setup_qualified_prospect(org_a.id, with_live_email=True)

    class _BrokenSMTP(_FakeSMTP):
        def login(self, username, password) -> None:
            raise smtplib.SMTPAuthenticationError(535, b"bad credentials")

    monkeypatch.setattr(smtplib, "SMTP", _BrokenSMTP)
    monkeypatch.setattr(channels_email.time, "sleep", lambda _seconds: None)
    fake = _FakeClient(
        [_response(_STRATEGY_SEND), _response(_PERSONALISATION), _response(_GROUNDING_OK)]
    )
    monkeypatch.setattr(llm, "_client", lambda: fake)

    step_module.step(org_a.id, cp["id"])

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        touches = repo.list("touches", filters={"cp_id": cp["id"]})
        updated_cp = repo.get("campaign_prospects", cp["id"])

    assert touches[0]["status"] == "failed"
    assert updated_cp["stage"] == "qualified"  # never advanced past qualified
    assert updated_cp["failures"] == 1


def test_no_live_integration_still_behaves_like_sandbox(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    cp = _setup_qualified_prospect(org_a.id, with_live_email=False)
    fake = _FakeClient(
        [_response(_STRATEGY_SEND), _response(_PERSONALISATION), _response(_GROUNDING_OK)]
    )
    monkeypatch.setattr(llm, "_client", lambda: fake)

    step_module.step(org_a.id, cp["id"])

    with org_connection(org_a.id) as conn:
        touches = OrgScopedRepo(conn, org_a.id).list("touches", filters={"cp_id": cp["id"]})

    assert touches[0]["status"] == "sent"
    assert touches[0]["provider_id"] is None  # nothing was actually transmitted
