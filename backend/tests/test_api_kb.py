"""API-level tests for the Knowledge Base file upload route (spec sections 10 and
12.5), through the real FastAPI app against a real Postgres.
"""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from ai import llm
from main import app


def _client(org) -> TestClient:
    client = TestClient(app)
    client.headers["Authorization"] = f"Bearer {org.api_key}"
    return client


class _FakeEmbeddings:
    def create(
        self, *, model: str, input: list[str], dimensions: int | None = None
    ) -> SimpleNamespace:
        return SimpleNamespace(data=[SimpleNamespace(embedding=[0.0]) for _ in input])


class _FakeClient:
    def __init__(self) -> None:
        self.embeddings = _FakeEmbeddings()


def _fake_embed_model(monkeypatch) -> None:
    """Ingestion embeds every chunk it stores — fake the client, same as
    test_orchestrator_inbound.py, so this test never makes a real network call."""
    monkeypatch.setenv("EMBED_MODEL", "fake-embed-model")
    monkeypatch.setattr(llm, "_client", lambda: _FakeClient())


def test_upload_txt_extracts_and_ingests_it(monkeypatch, two_orgs, pg_server):
    if not pg_server["has_vector"]:
        pytest.skip("pgvector is not installed on this machine (needs root)")
    _fake_embed_model(monkeypatch)
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post(
        "/kb/documents/upload",
        data={"doc_type": "playbook"},
        files={"file": ("cadence.txt", b"Wait 3 days between touches.", "text/plain")},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["doc_type"] == "playbook"
    assert body["title"] == "cadence.txt"

    listed = client.get("/kb/documents").json()
    assert any(d["id"] == body["id"] for d in listed)


def test_upload_uses_explicit_title_over_filename(monkeypatch, two_orgs, pg_server):
    if not pg_server["has_vector"]:
        pytest.skip("pgvector is not installed on this machine (needs root)")
    _fake_embed_model(monkeypatch)
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post(
        "/kb/documents/upload",
        data={"doc_type": "faq", "title": "Pricing FAQ"},
        files={"file": ("faq.md", b"# FAQ", "text/markdown")},
    )

    assert response.status_code == 201
    assert response.json()["title"] == "Pricing FAQ"


def test_upload_rejects_unsupported_file_type(two_orgs):
    org_a, _org_b = two_orgs
    client = _client(org_a)

    response = client.post(
        "/kb/documents/upload",
        data={"doc_type": "playbook"},
        files={"file": ("data.xlsx", b"not really a spreadsheet", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "unsupported_file_type"


def test_upload_rejects_a_campaign_from_another_org(two_orgs):
    org_a, org_b = two_orgs
    client_a = _client(org_a)
    campaign_id = _client(org_b).post("/campaigns", json={"name": "Org B's campaign"}).json()["id"]

    response = client_a.post(
        "/kb/documents/upload",
        data={"doc_type": "playbook", "campaign_id": campaign_id},
        files={"file": ("notes.txt", b"content", "text/plain")},
    )

    assert response.status_code == 404
