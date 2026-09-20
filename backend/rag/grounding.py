"""Grounding check (spec section 12.6): the last guardrail before anything customer-
facing goes out. Runs on Personalisation's draft at temperature 0, comparing every
claim against the sources it was allowed to use.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from agents.types import Chunk
from ai.llm import RunMeta, call_structured

PROMPT = load_prompt(__file__, "grounding")

RiskyTopic = Literal["pricing", "legal", "commitment"]


class ClaimCheck(BaseModel):
    text: str
    supported: bool
    source_id: str | None = None


class GroundingOutput(BaseModel):
    claims: list[ClaimCheck] = Field(default_factory=list)
    all_supported: bool
    risky_topics: list[RiskyTopic] = Field(default_factory=list)


def _user_message(message: str, sources: list[Chunk]) -> str:
    sources_text = "\n".join(f"[{s.id}] {s.content}" for s in sources) or "(no sources provided)"
    return f"MESSAGE:\n{message}\n\nSOURCES:\n{sources_text}"


def check_grounding(
    message: str, sources: list[Chunk], *, org_id: str | None = None
) -> tuple[GroundingOutput, RunMeta]:
    return call_structured(
        org_id=org_id,
        system=PROMPT,
        user=_user_message(message, sources),
        schema=GroundingOutput,
        tier="small",
        temperature=0.0,
    )


def forces_escalation(output: GroundingOutput) -> bool:
    """Code-level override (spec section 12.3): any risky topic forces human escalation
    regardless of what `all_supported` says."""
    return bool(output.risky_topics)
