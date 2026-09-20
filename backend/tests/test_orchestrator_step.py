"""orchestrator.step against a real Postgres, with the LLM faked — proves the wiring
(loading context, calling an agent, writing jsonb columns, updating campaign_prospects)
actually works end to end, not just that each piece works in isolation.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from ai import llm
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.step import step


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


def test_discovered_prospect_advances_to_researched(monkeypatch, two_orgs):
    org_a, _org_b = two_orgs
    research_json = (
        '{"company_summary": "Mid-size freight brokerage.", "industry": "Logistics", '
        '"size_band": "200-500", "recent_news": [], "likely_pains": ["dispatch delays"], '
        '"languages_served": ["en"], "facts": []}'
    )
    fake = _FakeClient([_response(research_json)])
    monkeypatch.setattr(llm, "_client", lambda: fake)

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        campaign = repo.insert("campaigns", {"name": "Test Campaign", "status": "live"})
        prospect_data = {
            "full_name": "Jordan Lee",
            "company": "Acme Logistics",
            "role": "VP Sales",
        }
        prospect = repo.insert("prospects", prospect_data)
        cp = repo.insert(
            "campaign_prospects", {"campaign_id": campaign["id"], "prospect_id": prospect["id"]}
        )

    step(org_a.id, cp["id"])

    with org_connection(org_a.id) as conn:
        repo = OrgScopedRepo(conn, org_a.id)
        updated_cp = repo.get("campaign_prospects", cp["id"])
        agent_runs = repo.list("agent_runs", filters={"cp_id": cp["id"]})

    assert updated_cp["stage"] == "researched"
    assert updated_cp["research"]["industry"] == "Logistics"
    assert len(agent_runs) == 1
    assert agent_runs[0]["agent"] == "research"
    assert agent_runs[0]["status"] == "ok"
