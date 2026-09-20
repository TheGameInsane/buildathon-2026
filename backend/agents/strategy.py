"""Outreach Strategy agent — the one brain per prospect (spec sections 2 and 12.3).
The only decision-maker for what happens next; every other agent is a specialist the
orchestrator calls on its behalf. The Follow-up agent's output is advisory only: it is
passed in as `follow_up_hint`, and Strategy makes the final call.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from agents.types import Channel, Chunk
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "strategy")

Action = Literal["send", "call", "wait", "stop", "escalate"]
Intent = Literal["intro", "follow_up", "answer_question", "book_meeting", "referral", "breakup"]


class FollowUpHint(BaseModel):
    follow_up: bool
    channel: Channel | None = None
    angle: str | None = None
    wait_hours: int | None = None
    reason: str


class StrategyInput(BaseModel):
    prospect_summary: str  # compact, not raw research
    timeline: str  # compact cross-channel timeline text (spec section 12.3)
    channel_policy: dict = Field(default_factory=dict)
    touches_this_week: int = 0
    weekly_cap: int
    now: str
    playbook_chunks: list[Chunk] = Field(default_factory=list)
    follow_up_hint: FollowUpHint | None = None


class StrategyOutput(BaseModel):
    action: Action
    channel: Channel | None = None
    send_after_hours: int = 0
    intent: Intent
    reason: str


def _user_message(data: StrategyInput) -> str:
    playbook = (
        "\n".join(f"- {c.content}" for c in data.playbook_chunks)
        or "(no playbook knowledge provided)"
    )
    hint = (
        f"\n\nFOLLOW_UP_HINT (advisory only): {data.follow_up_hint.model_dump_json()}"
        if data.follow_up_hint
        else ""
    )
    return (
        f"PROSPECT_SUMMARY: {data.prospect_summary}\n\n"
        f"TIMELINE:\n{data.timeline}\n\n"
        f"CHANNEL_POLICY: {data.channel_policy}\n"
        f"TOUCHES_THIS_WEEK: {data.touches_this_week}/{data.weekly_cap}\n"
        f"NOW: {data.now}\n\n"
        f"PLAYBOOK:\n{playbook}"
        f"{hint}"
    )


def run(
    data: StrategyInput,
    *,
    org_id: str | None = None,
    tier: Literal["small", "strong"] = "small",
    system_prompt: str | None = None,
) -> tuple[StrategyOutput, RunMeta]:
    """Model tier defaults to small; the orchestrator passes tier="strong" for hard
    cases (spec section 12.3's model-tier table)."""
    return call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=_user_message(data),
        schema=StrategyOutput,
        tier=tier,
    )


if __name__ == "__main__":
    sample = StrategyInput(
        prospect_summary="VP Sales at a mid-size freight brokerage; fits ICP (score 82).",
        timeline=(
            "[Day 0] Email #1 sent (intro) - opened, no reply\n"
            "[Day 2] Email #2 sent (case study) - opened 2x, no reply\n"
        ),
        channel_policy={"call": "after_engagement_only"},
        touches_this_week=2,
        weekly_cap=3,
        now="2026-09-20T10:00:00Z",
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
