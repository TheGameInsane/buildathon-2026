"""Personalisation / Email agent (spec section 12.3). Writes the outbound message once
Strategy has decided to send. `rag.grounding.check_grounding` validates the draft
afterwards — this agent is not itself the guardrail.
"""

from __future__ import annotations

from pydantic import BaseModel, Field

from agents.prompt_render import load_prompt, render_template
from agents.types import Channel, Chunk, Fact
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT_TEMPLATE = load_prompt(__file__, "personalisation")


class PersonalisationInput(BaseModel):
    facts: list[Fact] = Field(default_factory=list)
    intent: str
    channel: Channel
    tone: str
    language: str
    rep_signature: str
    sender_footer: str
    kb_chunks: list[Chunk] = Field(default_factory=list)  # retrieved by code before this call


class PersonalisationOutput(BaseModel):
    subject: str | None = None
    body: str
    facts_used: list[int] = Field(default_factory=list)
    kb_chunks_used: list[str] = Field(default_factory=list)


def _user_message(data: PersonalisationInput) -> str:
    facts_text = (
        "\n".join(f"[{i}] {f.claim} (source: {f.source_url})" for i, f in enumerate(data.facts))
        or "(no facts provided)"
    )
    kb_text = (
        "\n".join(f"- ({c.id}) {c.content}" for c in data.kb_chunks) or "(no knowledge provided)"
    )
    return (
        f"TONE: {data.tone}\nLANGUAGE: {data.language}\n\n"
        f"FACTS:\n{facts_text}\n\nKNOWLEDGE:\n{kb_text}\n\n"
        f"Sign with: {data.rep_signature}\nAppend footer: {data.sender_footer}"
    )


def run(
    data: PersonalisationInput, *, org_id: str | None = None, system_prompt: str | None = None
) -> tuple[PersonalisationOutput, RunMeta]:
    system = system_prompt or render_template(
        DEFAULT_PROMPT_TEMPLATE,
        channel=data.channel,
        intent=data.intent,
        rep_signature=data.rep_signature,
    )
    return call_structured(
        org_id=org_id,
        system=system,
        user=_user_message(data),
        schema=PersonalisationOutput,
        tier="strong",
        temperature=0.7,  # spec section 12.1: ~0.7 for message writing
    )


if __name__ == "__main__":
    sample = PersonalisationInput(
        facts=[Fact(claim="Acme Logistics is expanding dispatch across 3 time zones.", source_url="https://acmelogistics.com/about")],
        intent="intro",
        channel="email",
        tone="warm, consultative",
        language="en",
        rep_signature="Priya, Account Executive",
        sender_footer="Unsubscribe anytime by replying STOP.",
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
