"""ICP Fitment agent (spec section 12.3). Triggered once research is done. The model
proposes a raw 0-100 score; the `fit`/`no_fit`/`review` verdict is derived in code from
`score` and the campaign's `fit_threshold` — never trusted from the model (spec section
2, "the LLM proposes, the code disposes").
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from agents.research import ResearchOutput
from agents.types import Chunk
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "fitment")

Verdict = Literal["fit", "no_fit", "review"]


class FitmentInput(BaseModel):
    research: ResearchOutput
    role: str
    icp_chunks: list[Chunk] = Field(default_factory=list)
    icp: dict = Field(default_factory=dict)


class _ModelOutput(BaseModel):
    """What the model itself returns. `run()` turns this into `FitmentOutput` by
    deriving `verdict` in code — see the module docstring."""

    score: int = Field(ge=0, le=100)
    criteria_met: list[str] = Field(default_factory=list)
    criteria_missed: list[str] = Field(default_factory=list)
    reason: str


class FitmentOutput(BaseModel):
    score: int
    verdict: Verdict
    criteria_met: list[str]
    criteria_missed: list[str]
    reason: str


def _verdict_for(score: int, fit_threshold: int) -> Verdict:
    if score >= fit_threshold:
        return "fit"
    if score < fit_threshold - 20:
        return "no_fit"
    return "review"


def _user_message(data: FitmentInput) -> str:
    icp_text = "\n".join(f"- {c.content}" for c in data.icp_chunks) or "(no ICP knowledge provided)"
    return (
        f"ROLE: {data.role}\n"
        f"RESEARCH: {data.research.model_dump_json()}\n"
        f"ICP_DEFINITION: {data.icp}\n\n"
        f"ICP_KNOWLEDGE:\n{icp_text}"
    )


def run(
    data: FitmentInput,
    *,
    fit_threshold: int = 70,
    org_id: str | None = None,
    system_prompt: str | None = None,
) -> tuple[FitmentOutput, RunMeta]:
    model_output, meta = call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=_user_message(data),
        schema=_ModelOutput,
        tier="small",
    )
    output = FitmentOutput(
        score=model_output.score,
        verdict=_verdict_for(model_output.score, fit_threshold),
        criteria_met=model_output.criteria_met,
        criteria_missed=model_output.criteria_missed,
        reason=model_output.reason,
    )
    return output, meta


if __name__ == "__main__":
    from agents.research import ResearchOutput as _RO

    sample = FitmentInput(
        research=_RO(
            company_summary="Mid-size freight brokerage in Toronto.",
            industry="Logistics",
            size_band="200-500",
            likely_pains=["multilingual customer support", "after-hours dispatch"],
        ),
        role="VP Sales",
        icp=(
            {"target_roles": ["VP Sales", "COO"], "min_size": 100, "industries": ["Logistics"]}
        ),
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
