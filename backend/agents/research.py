"""Lead Research and Enrichment agent (spec section 12.3). Triggered when a prospect
is discovered. Uses no knowledge base — it works only from web snippets the
orchestrator fetched, never from model memory.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt
from agents.types import Fact
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "research")


class ResearchInput(BaseModel):
    name: str
    company: str
    domain: str
    role: str
    country: str | None = None
    web_snippets: list[str] = Field(default_factory=list)


class ResearchOutput(BaseModel):
    company_summary: str
    industry: str
    size_band: str
    recent_news: list[str] = Field(default_factory=list)
    likely_pains: list[str] = Field(default_factory=list)
    languages_served: list[str] = Field(default_factory=list)
    facts: list[Fact] = Field(default_factory=list)


def _user_message(data: ResearchInput) -> str:
    snippets = "\n".join(f"- {s}" for s in data.web_snippets) or "(none provided)"
    location = f", {data.country}" if data.country else ""
    return (
        f"Prospect: {data.name}, {data.role} at {data.company} ({data.domain}){location}.\n\n"
        f"WEB_SNIPPETS:\n{snippets}"
    )


def run(
    data: ResearchInput, *, org_id: str | None = None, system_prompt: str | None = None
) -> tuple[ResearchOutput, RunMeta]:
    return call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=_user_message(data),
        schema=ResearchOutput,
        tier="small",
    )


if __name__ == "__main__":
    sample = ResearchInput(
        name="Jordan Lee",
        role="VP Sales",
        company="Acme Logistics",
        domain="acmelogistics.com",
        country="Canada",
        web_snippets=[
            "Acme Logistics (acmelogistics.com) is a mid-size freight brokerage "
            "headquartered in Toronto, operating across North America.",
            "Acme Logistics' careers page lists open roles for 'Customer Support "
            "Automation Lead' and 'Bilingual Dispatch Coordinator'.",
        ],
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
