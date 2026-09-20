"""Small helpers shared by orchestrator.step and orchestrator.inbound — both write
`agent_runs` rows and schedule `next_action_at` the same way."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import UUID

from ai.llm import RunMeta
from db.repository import OrgScopedRepo


def now() -> datetime:
    return datetime.now(UTC)


def soon(seconds: int = 5) -> datetime:
    return now() + timedelta(seconds=seconds)


def later(*, hours: float = 0, minutes: float = 0) -> datetime:
    return now() + timedelta(hours=hours, minutes=minutes)


def uuid_list(ids: list[str]) -> list[UUID] | None:
    return [UUID(i) for i in ids] if ids else None


def log_agent_run(
    repo: OrgScopedRepo,
    *,
    cp_id: str,
    campaign_id: str,
    agent: str,
    input_data: dict,
    output_data: dict,
    reason: str | None,
    kb_chunk_ids: list[str],
    meta: RunMeta,
    prompt_version_id: str | None = None,
) -> dict:
    return repo.insert(
        "agent_runs",
        {
            "cp_id": cp_id,
            "campaign_id": campaign_id,
            "agent": agent,
            "input": input_data,
            "output": output_data,
            "reason": reason,
            "kb_chunk_ids": uuid_list(kb_chunk_ids),
            "prompt_version_id": prompt_version_id,
            "model": meta.model,
            "tokens_in": meta.tokens_in,
            "tokens_out": meta.tokens_out,
            "cost_usd": meta.cost_usd,
            "latency_ms": meta.latency_ms,
            "attempts": meta.attempts,
            "status": meta.status,
        },
    )
