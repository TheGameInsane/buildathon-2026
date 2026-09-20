"""Voice SDR agent (spec sections 12.3 and 12.7). The live qualification call itself
runs on DronaHQ's voice agent, configured with `CALL_SCRIPT_TEMPLATE` below (rendered
once per campaign, not through `call_structured` — it's pushed to the provider as
config, not an LLM call this backend makes). This module is the other half: once the
call ends, a small-model call extracts structured outcome data from the transcript.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "voice_extraction")
CALL_SCRIPT_TEMPLATE = load_prompt(__file__, "voice_call_script")

Outcome = Literal["qualified", "not_qualified", "no_answer", "callback", "escalate"]


class VoiceExtractionInput(BaseModel):
    transcript: str


class VoiceOut(BaseModel):
    transcript: str
    outcome: Outcome
    qualified: bool
    meeting_time: str | None = None
    objections: list[str] = Field(default_factory=list)
    next_step: str


def run(
    data: VoiceExtractionInput, *, org_id: str | None = None, system_prompt: str | None = None
) -> tuple[VoiceOut, RunMeta]:
    output, meta = call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=f"CALL_TRANSCRIPT:\n{data.transcript}",
        schema=VoiceOut,
        tier="small",
    )
    # The model never sees itself asked to echo the transcript back; keep it exact.
    return output.model_copy(update={"transcript": data.transcript}), meta


if __name__ == "__main__":
    sample = VoiceExtractionInput(
        transcript=(
            "Agent: Hi, is this Jordan? I'm calling on behalf of Acme AI about your "
            "dispatch automation. Do you have two minutes?\n"
            "Jordan: Sure, go ahead.\n"
            "Agent: Are you currently handling multilingual customer support in-house?\n"
            "Jordan: Yes, it's a pain point, we outsource some of it.\n"
            "Agent: Would Tuesday at 2pm work for a quick call with our team?\n"
            "Jordan: Yes, that works."
        )
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
