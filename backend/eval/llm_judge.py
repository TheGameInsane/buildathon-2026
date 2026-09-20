"""The LLM judge (spec section 12.8): scores a generated message 1-5 on personalisation,
accuracy, clarity and call-to-action, using the strong model at temperature 0 so scoring
is repeatable across runs of the same prompt version.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from ai.llm import RunMeta, call_structured

_SYSTEM_PROMPT = (
    "You are a sales message quality judge. Score the MESSAGE from 1 (poor) to 5 "
    "(excellent) on each of: personalisation (uses specific facts, not generic), "
    "accuracy (no invented claims), clarity (easy to read, one clear ask), and "
    "call_to_action (a single, clear next step). Be strict and consistent."
)


class JudgeScores(BaseModel):
    personalisation: int = Field(ge=1, le=5)
    accuracy: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    call_to_action: int = Field(ge=1, le=5)
    reason: str


def judge_message(message: str, *, org_id: str | None = None) -> tuple[JudgeScores, RunMeta]:
    return call_structured(
        org_id=org_id,
        system=_SYSTEM_PROMPT,
        user=f"MESSAGE:\n{message}",
        schema=JudgeScores,
        tier="strong",
        temperature=0.0,
    )
