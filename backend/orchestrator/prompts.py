"""The one source of truth for which prompt an agent runs (spec section 12.4). Both
`api/prompts.py` (Prompt Studio's routes) and `orchestrator/step.py` /
`orchestrator/inbound.py` (the actual agent calls) go through this module, so
activating a version in Prompt Studio is the only thing that changes what the agent
runs next — there is no second, hardcoded copy of a prompt anywhere else.

With no version ever activated for a campaign/agent pair, `active_prompt` returns
`(None, None)` and the caller passes `system_prompt=None` into the agent, which then
falls back to its own shipped default template — same behaviour as today, just now the
one and only fallback path instead of the only path.
"""

from __future__ import annotations

import psycopg

from agents import conversation, fitment, follow_up, personalisation, research, strategy

# The pipeline agents Prompt Studio can version (spec section 12.3).
DEFAULT_PROMPTS: dict[str, str] = {
    "research": research.DEFAULT_PROMPT,
    "fitment": fitment.DEFAULT_PROMPT,
    "strategy": strategy.DEFAULT_PROMPT,
    "personalisation": personalisation.DEFAULT_PROMPT_TEMPLATE,
    "conversation": conversation.DEFAULT_PROMPT,
    "follow_up": follow_up.DEFAULT_PROMPT,
}


def default_prompt(agent: str) -> str:
    return DEFAULT_PROMPTS.get(agent, "")


def active_version_id(
    conn: psycopg.Connection, org_id: str, campaign_id: str, agent: str
) -> str | None:
    row = conn.execute(
        "select active_prompt_version_id from campaign_agents "
        "where org_id = %s and campaign_id = %s and agent = %s",
        (org_id, campaign_id, agent),
    ).fetchone()
    return str(row["active_prompt_version_id"]) if row and row["active_prompt_version_id"] else None


def active_prompt(
    conn: psycopg.Connection, org_id: str, campaign_id: str, agent: str
) -> tuple[str | None, str | None]:
    """Returns `(body, prompt_version_id)` for the campaign's active version of
    `agent`, or `(None, None)` if none has ever been activated."""
    row = conn.execute(
        "select pv.body, pv.id from campaign_agents ca "
        "join prompt_versions pv on pv.id = ca.active_prompt_version_id "
        "where ca.org_id = %s and ca.campaign_id = %s and ca.agent = %s",
        (org_id, campaign_id, agent),
    ).fetchone()
    if row is None:
        return None, None
    return row["body"], str(row["id"])


def activate(
    conn: psycopg.Connection, org_id: str, campaign_id: str, agent: str, version_id: str
) -> None:
    conn.execute(
        "insert into campaign_agents (org_id, campaign_id, agent, active_prompt_version_id) "
        "values (%s, %s, %s, %s) "
        "on conflict (campaign_id, agent) do update "
        "set active_prompt_version_id = excluded.active_prompt_version_id",
        (org_id, campaign_id, agent, version_id),
    )
