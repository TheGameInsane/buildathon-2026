"""ai/llm.py — call_structured() (spec section 12.1). The OpenAI client is faked, so
these are pure unit tests of the wrapper's own behaviour: the minimum needed to trust
the happy path, the one-shot JSON repair, and the budget gate before every agent uses it.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from ai import llm
from ai.budget import BudgetExceededError
from db.connection import org_connection


class _Out(BaseModel):
    value: int


def _response(content: str, tokens_in: int = 10, tokens_out: int = 5) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))],
        usage=SimpleNamespace(prompt_tokens=tokens_in, completion_tokens=tokens_out),
    )


class _FakeChatCompletions:
    def __init__(self, replies: list) -> None:
        self._replies = list(replies)
        self.calls = 0

    def create(self, **kwargs) -> SimpleNamespace:
        self.calls += 1
        return self._replies.pop(0)


class _FakeClient:
    def __init__(self, replies: list) -> None:
        self.chat = SimpleNamespace(completions=_FakeChatCompletions(replies))


@pytest.fixture(autouse=True)
def _llm_env(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_SMALL", "gpt-4o-mini")
    monkeypatch.setenv("MODEL_STRONG", "gpt-4o")
    monkeypatch.setenv("EMBED_MODEL", "text-embedding-3-small")


@pytest.fixture()
def unlimited_org(two_orgs) -> str:
    org_a, _ = two_orgs
    return org_a.id


def test_happy_path_returns_validated_output_and_meta(monkeypatch, unlimited_org):
    fake = _FakeClient([_response('{"value": 5}')])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    output, meta = llm.call_structured(
        org_id=unlimited_org, system="sys", user="usr", schema=_Out, tier="small"
    )

    assert output.value == 5
    assert meta.model == "gpt-4o-mini"
    assert meta.status == "ok"
    assert fake.chat.completions.calls == 1


def test_repairs_invalid_json_once_then_succeeds(monkeypatch, unlimited_org):
    fake = _FakeClient([_response("not json at all"), _response('{"value": 9}')])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    output, meta = llm.call_structured(
        org_id=unlimited_org, system="sys", user="usr", schema=_Out, tier="small"
    )

    assert output.value == 9
    assert meta.status == "repaired"
    assert fake.chat.completions.calls == 2


def test_exhausted_budget_is_checked_before_calling_the_model(monkeypatch, two_orgs):
    org_a, _ = two_orgs
    with org_connection(org_a.id) as conn:
        conn.execute(
            "update organizations set monthly_budget_usd = 0 where id = %s", (org_a.id,)
        )

    fake = _FakeClient([_response('{"value": 1}')])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    with pytest.raises(BudgetExceededError):
        llm.call_structured(org_id=org_a.id, system="sys", user="usr", schema=_Out, tier="small")
    assert fake.chat.completions.calls == 0  # never reached the model
