"""Inbound message handling (spec section 9): "Inbound reply (webhook or IMAP) ->
Conversation agent, then wake Strategy." Whatever the source — a WhatsApp webhook,
and eventually IMAP-polled email — every inbound reply goes through the same
pipeline: match it to a prospect, classify it, record it, and nudge it back through
Strategy on the worker's next pass.

This module records the reply and runs Conversation synchronously (that part is
inherently "process this message now"), but deliberately does not call Strategy itself
— it only sets `next_action_at = now()` and lets the worker's normal loop pick it up,
so a slow or failing Strategy call never blocks the webhook response.
"""

from __future__ import annotations

from agents import conversation
from agents.types import Channel, Chunk
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.common import log_agent_run, now
from orchestrator.prompts import active_prompt
from rag import retrieval

# Which prospect column a channel's inbound "from" identifier matches against, and
# which column to add to org-wide suppression on unsubscribe.
_IDENTIFIER_COLUMN: dict[Channel, str] = {
    "email": "email",
    "whatsapp": "phone",
    "call": "phone",
}

_ENGAGEMENT_PROMOTES_FROM = {"contacted"}


def _match_prospect(
    repo: OrgScopedRepo, channel: Channel, from_identifier: str, thread_key: str | None
) -> dict | None:
    """Matches by thread ID first, sender address second (spec section 11)."""
    if thread_key:
        touches = repo.list("touches", filters={"thread_key": thread_key})
        if touches:
            return repo.get("campaign_prospects", touches[0]["cp_id"])

    column = _IDENTIFIER_COLUMN.get(channel)
    if column is None or not from_identifier:
        return None
    prospects = repo.list("prospects", filters={column: from_identifier})
    if not prospects:
        return None

    candidates = []
    for prospect in prospects:
        for cp in repo.list("campaign_prospects", filters={"prospect_id": prospect["id"]}):
            if cp["stage"] not in ("disqualified", "stopped"):
                candidates.append(cp)
    if not candidates:
        return None
    # Prefer the most-advanced-in-its-funnel match — the one most likely mid-conversation.
    candidates.sort(key=lambda cp: cp.get("step_number") or 0, reverse=True)
    return candidates[0]


def _thread_for(repo: OrgScopedRepo, cp_id: str) -> list[conversation.ThreadMessage]:
    touches = repo.list("touches", filters={"cp_id": cp_id}, order_by="created_at")
    messages = []
    for touch in touches:
        if touch["direction"] not in ("inbound", "outbound") or not touch.get("body"):
            continue
        sender = "prospect" if touch["direction"] == "inbound" else "rep"
        messages.append(
            conversation.ThreadMessage.model_validate(
                {"from": sender, "text": touch["body"], "at": touch["created_at"].isoformat()}
            )
        )
    return messages


def _process_inbound(
    repo: OrgScopedRepo,
    cp: dict,
    *,
    channel: Channel,
    text: str,
    thread_key: str | None,
    provider_id: str | None,
) -> dict:
    prospect = repo.get("prospects", cp["prospect_id"])
    campaign = repo.get("campaigns", cp["campaign_id"])

    touch = repo.insert(
        "touches",
        {
            "cp_id": cp["id"],
            "step_number": cp.get("step_number") or 0,
            "channel": channel,
            "direction": "inbound",
            "kind": channel,
            "status": "received",
            "body": text,
            "provider_id": provider_id,
            "thread_key": thread_key,
        },
    )

    kb_chunks: list[Chunk] = retrieval.retrieve(
        repo.org_id,
        retrieval.build_query(text, "reply"),
        doc_types=["objection_handling", "faq"],
        campaign_id=campaign["id"],
    )
    conversation_input = conversation.ConversationInput(
        reply=text, channel=channel, thread=_thread_for(repo, cp["id"]), kb_chunks=kb_chunks
    )
    prompt_body, prompt_version_id = active_prompt(
        repo.conn, repo.org_id, campaign["id"], "conversation"
    )
    output, meta = conversation.run(
        conversation_input, org_id=repo.org_id, system_prompt=prompt_body
    )
    agent_run = log_agent_run(
        repo,
        cp_id=cp["id"],
        campaign_id=campaign["id"],
        agent="conversation",
        input_data=conversation_input.model_dump(),
        output_data=output.model_dump(),
        reason=output.reason,
        kb_chunk_ids=[c.id for c in kb_chunks],
        meta=meta,
        prompt_version_id=prompt_version_id,
    )
    repo.update("touches", touch["id"], {"agent_run_id": agent_run["id"]})

    if output.intent == "unsubscribe":
        suppression_column = _IDENTIFIER_COLUMN.get(channel)
        if suppression_column and prospect.get(suppression_column):
            repo.insert(
                "suppression",
                {
                    suppression_column: prospect[suppression_column],
                    "reason": "unsubscribed",
                    "source_cp_id": cp["id"],
                },
            )
        repo.update("campaign_prospects", cp["id"], {"stage": "stopped", "next_action_at": None})
    else:
        updates: dict = {"next_action_at": now()}  # wake Strategy on the worker's next pass
        if cp["stage"] in _ENGAGEMENT_PROMOTES_FROM:
            updates["stage"] = "engaged"
        repo.update("campaign_prospects", cp["id"], updates)

    return cp


def handle_inbound_reply(
    org_id: str,
    *,
    channel: Channel,
    from_identifier: str,
    text: str,
    thread_key: str | None = None,
    provider_id: str | None = None,
) -> dict | None:
    """For callers that only have an identifier to match against (a webhook payload's
    "from" field) — the WhatsApp/email path. Returns the matched campaign_prospects
    row, or `None` if nothing matched (still logged to `activity_log`, never silently
    dropped)."""
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        cp = _match_prospect(repo, channel, from_identifier, thread_key)
        if cp is None:
            repo.insert(
                "activity_log",
                {
                    "actor": f"webhook:{channel}",
                    "action": "unmatched_inbound",
                    "summary": f"No prospect matched {from_identifier!r} on {channel}",
                },
            )
            return None
        return _process_inbound(
            repo, cp, channel=channel, text=text, thread_key=thread_key, provider_id=provider_id
        )


