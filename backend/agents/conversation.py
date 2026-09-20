"""Conversation agent (spec section 12.3). Classifies an inbound reply and drafts a
suggested response grounded in KB. A reply matching an unsubscribe phrase is forced to
`intent = "unsubscribe"` in code regardless of the model's classification (spec section
12.3, "code-level overrides") — the model's judgement can be wrong, but this cannot.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from agents.prompt_render import load_prompt
from agents.types import Channel, Chunk
from ai.llm import RunMeta, call_structured

DEFAULT_PROMPT = load_prompt(__file__, "conversation")

ReplyIntent = Literal[
    "interested", "question", "objection", "not_now", "unsubscribe", "wrong_person", "ooo"
]
Sentiment = Literal["positive", "neutral", "negative"]

_UNSUBSCRIBE_PHRASES = ("unsubscribe", "stop", "remove me", "do not contact")


class ThreadMessage(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    from_: str = Field(alias="from")
    text: str
    at: str


class ConversationInput(BaseModel):
    reply: str
    channel: Channel
    thread: list[ThreadMessage] = Field(default_factory=list)
    kb_chunks: list[Chunk] = Field(default_factory=list)


class ConversationOutput(BaseModel):
    intent: ReplyIntent
    sentiment: Sentiment
    needs_human: bool
    suggested_reply: str | None = None
    referral_name: str | None = None
    referral_email: str | None = None
    ooo_return_date: str | None = None
    reason: str


def _mentions_unsubscribe(text: str) -> bool:
    lowered = text.lower()
    return any(phrase in lowered for phrase in _UNSUBSCRIBE_PHRASES)


def _user_message(data: ConversationInput) -> str:
    thread_text = (
        "\n".join(f"[{m.at}] {m.from_}: {m.text}" for m in data.thread) or "(no prior thread)"
    )
    kb_text = (
        "\n".join(f"- ({c.id}) {c.content}" for c in data.kb_chunks) or "(no knowledge provided)"
    )
    return (
        f"CHANNEL: {data.channel}\n\nTHREAD:\n{thread_text}\n\n"
        f"LATEST_REPLY:\n{data.reply}\n\nKNOWLEDGE:\n{kb_text}"
    )


def run(
    data: ConversationInput, *, org_id: str | None = None, system_prompt: str | None = None
) -> tuple[ConversationOutput, RunMeta]:
    output, meta = call_structured(
        org_id=org_id,
        system=system_prompt or DEFAULT_PROMPT,
        user=_user_message(data),
        schema=ConversationOutput,
        tier="small",
    )
    if _mentions_unsubscribe(data.reply):
        output = output.model_copy(update={"intent": "unsubscribe", "needs_human": False})
    return output, meta


if __name__ == "__main__":
    sample = ConversationInput(
        reply="Thanks, this looks interesting - can you tell me more about pricing?",
        channel="email",
    )
    output, meta = run(sample)
    print(output.model_dump_json(indent=2))
    print(meta)
