"""Follow-up agent (spec section 12.3). Triggered when a timer fires with no reply.
Advisory only: its output is passed to Strategy as `follow_up_hint` (agents/strategy.py)
and Strategy makes the final decision — this keeps one owner per prospect.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from agents.types import Channel, Chunk
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "follow_up")


class FollowUpInput(BaseModel):
    timeline: str
    touches_so_far: int
    max_touches: int
    previous_angle: str | None = None
    playbook_chunks: list[Chunk] = Field(default_factory=list)


class FollowUpOutput(BaseModel):
    follow_up: bool
    channel: Channel | None = None
    angle: str | None = None
    wait_hours: int | None = None
    reason: str


def _user_message(data: FollowUpInput) -> str:
    playbook = (
        "\n".join(f"- {c.content}" for c in data.playbook_chunks)
        or "(no playbook knowledge provided)"
    )
    return (
        f"TIMELINE:\n{data.timeline}\n\n"
        f"TOUCHES_SO_FAR: {data.touches_so_far}/{data.max_touches}\n"
        f"PREVIOUS_ANGLE: {data.previous_angle or '(none)'}\n\n"
        f"PLAYBOOK:\n{playbook}"
    )


def run(
    data: FollowUpInput, *, org_id: str | None = None, system_prompt: str | None = None
) -> tuple[FollowUpOutput, RunMeta]:
    return call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=_user_message(data),
        schema=FollowUpOutput,
        tier="small",
    )


if __name__ == "__main__":
    sample = FollowUpInput(
        timeline="[Day 2] Email #1 sent - no reply\n[Day 5] Email #2 sent - no reply",
        touches_so_far=2,
        max_touches=4,
        previous_angle="case study",
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
