"""Agent-level "code disposes" guarantees (spec section 2): the two places an agent's
own output is deliberately overridden by code rather than trusted from the model.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from agents import conversation, fitment, research
from ai import llm


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


@pytest.fixture(autouse=True)
def _llm_env(monkeypatch):
    monkeypatch.setenv("LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("LLM_API_KEY", "test-key")
    monkeypatch.setenv("MODEL_SMALL", "gpt-4o-mini")
    monkeypatch.setenv("MODEL_STRONG", "gpt-4o")


@pytest.fixture()
def unlimited_org(two_orgs) -> str:
    org_a, _ = two_orgs
    return org_a.id


@pytest.mark.parametrize(
    ("score", "fit_threshold", "expected_verdict"),
    [
        (85, 70, "fit"),  # at/above threshold
        (60, 70, "review"),  # within 20 points below threshold
        (30, 70, "no_fit"),  # more than 20 points below threshold
    ],
)
def test_fitment_verdict_is_derived_from_score_never_trusted_from_the_model(
    monkeypatch, unlimited_org, score, fit_threshold, expected_verdict
):
    # The model is asked for a raw score only - it has no verdict field at all, so if
    # the verdict came from the model this test couldn't even construct the reply.
    reply = f'{{"score": {score}, "criteria_met": [], "criteria_missed": [], "reason": "r"}}'
    fake = _FakeClient([_response(reply)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    sample = fitment.FitmentInput(
        research=research.ResearchOutput(company_summary="s", industry="i", size_band="b"),
        role="VP Sales",
    )
    output, _meta = fitment.run(sample, fit_threshold=fit_threshold, org_id=unlimited_org)

    assert output.score == score
    assert output.verdict == expected_verdict


def test_unsubscribe_phrase_overrides_the_models_classification(monkeypatch, unlimited_org):
    # The model misclassifies the reply as "interested" - the deterministic phrase
    # check must still force "unsubscribe" (spec section 12.3, code-level overrides).
    reply = '{"intent": "interested", "sentiment": "positive", "needs_human": false, "reason": "r"}'
    fake = _FakeClient([_response(reply)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    sample = conversation.ConversationInput(
        reply="Please unsubscribe me, stop emailing.", channel="email"
    )
    output, _meta = conversation.run(sample, org_id=unlimited_org)

    assert output.intent == "unsubscribe"
    assert output.needs_human is False
