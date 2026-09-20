"""The stage-based step function (spec section 9) — the only thing that advances a
prospect. Loads context from the database, calls the right agent (a pure function, no
DB access inside it), persists the `agent_runs` row itself, and updates
`campaign_prospects`. Every external action goes through `policy_gate.check_gate()`
immediately before it would happen.

Known gaps, so they're not mistaken for bugs: there is no real web search yet (Research
always runs with empty `web_snippets`), and no voice provider (a "call" action is
recorded `held` — spec section 12.7's DronaHQ contract is explicitly unverified).
Email and WhatsApp sends go through `channels/` for real when the org has a `live`
integration configured for that channel (`api/integrations.py`); with no live
integration, a send still behaves like sandbox mode (spec section 8): recorded, never
transmitted. Inbound replies have their own path — see `orchestrator.inbound` — which
wakes this same Strategy step; the Follow-up agent's timer-driven wake still isn't
wired in, so Strategy is otherwise only reached when the worker's periodic poll finds
`next_action_at` due.
"""

from __future__ import annotations

import json
from datetime import timedelta

from agents import fitment, personalisation, research, strategy
from agents.types import Fact
from channels import email as channels_email
from channels import whatsapp as channels_whatsapp
from channels.base import ChannelSendError, OutboundMessage, SendResult
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.common import later, log_agent_run, now, soon
from orchestrator.policy_gate import Action, GateResult, check_gate
from orchestrator.prompts import active_prompt
from rag import retrieval
from rag.grounding import check_grounding, forces_escalation
from tenancy.crypto import decrypt_secret

_DEFAULT_RECHECK_HOURS = 24
_HELD_RECHECK_MINUTES = 30
_RESCHEDULE_HOURS = 1
_ESCALATION_RECHECK_HOURS = 24

_DISPOSITION_TOUCH_STATUS = {
    "held": "held",
    "cancelled": "cancelled",
    "rescheduled": "rescheduled",
    "awaiting_approval": "awaiting_approval",
}

# Which integration provider(s) can carry a channel, and which prospect column its
# recipient address comes from. Email has two possible providers; the first live one
# found wins.
_CHANNEL_PROVIDERS: dict[str, tuple[str, ...]] = {
    "email": ("email_smtp_imap", "gmail_oauth"),
    "whatsapp": ("twilio_whatsapp",),
}
_RECIPIENT_FIELD: dict[str, str] = {"email": "email", "whatsapp": "phone"}


def _live_integration(repo: OrgScopedRepo, channel: str) -> dict | None:
    for provider in _CHANNEL_PROVIDERS.get(channel, ()):
        rows = repo.list("integrations", filters={"provider": provider, "mode": "live"})
        if rows:
            return rows[0]
    return None


def _send_via_channel(
    integration: dict, channel: str, recipient: str, subject: str | None, body: str, profile: dict
) -> SendResult:
    config = json.loads(decrypt_secret(integration["config_encrypted"]))
    message = OutboundMessage(to=recipient, subject=subject, body=body)
    if channel == "email":
        return channels_email.send(
            config,
            message,
            sender_footer=profile.get("sender_footer") or "",
            unsubscribe_text=profile.get("unsubscribe_text") or "",
        )
    if channel == "whatsapp":
        return channels_whatsapp.send(config, message)
    raise ChannelSendError(f"no adapter for channel {channel!r}")


def step(org_id: str, cp_id: str) -> None:
    """Advances one campaign_prospects row by exactly one stage-appropriate action."""
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        cp = repo.get("campaign_prospects", cp_id)
        campaign = repo.get("campaigns", cp["campaign_id"])
        prospect = repo.get("prospects", cp["prospect_id"])

        stage = cp["stage"]
        if stage == "discovered":
            _step_research(repo, cp, campaign, prospect, org_id)
        elif stage == "researched":
            _step_fitment(repo, cp, campaign, prospect, org_id)
        else:
            _step_strategy(conn, repo, cp, campaign, prospect, org_id)


def _prospect_summary(prospect: dict, cp: dict) -> str:
    research_output = cp.get("research") or {}
    summary = research_output.get("company_summary", "")
    role = prospect.get("role") or "unknown role"
    company = prospect.get("company") or "unknown company"
    verdict_bit = ""
    if cp.get("fit_verdict"):
        verdict_bit = f" Fit: {cp['fit_verdict']} (score {cp['fit_score']})."
    name = prospect.get("full_name") or "Prospect"
    return f"{name}, {role} at {company}. {summary}{verdict_bit}".strip()


def _compact_timeline(touches: list[dict]) -> str:
    """A rough approximation of spec section 12.3's "[Day N] channel: ..." format —
    exact open/click tracking isn't modelled yet, so this reports touch status only."""
    if not touches:
        return "(no touches yet)"
    first_day = touches[0]["created_at"]
    lines = []
    for touch in touches:
        day = (touch["created_at"] - first_day).days
        line = f"[Day {day}] {touch['channel']}: {touch['kind']} {touch['status']}"
        if touch.get("held_reason"):
            line += f" - {touch['held_reason']}"
        lines.append(line)
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# discovered -> researched
# ---------------------------------------------------------------------------


def _step_research(
    repo: OrgScopedRepo, cp: dict, campaign: dict, prospect: dict, org_id: str
) -> None:
    agent_input = research.ResearchInput(
        name=prospect.get("full_name") or "Unknown",
        company=prospect.get("company") or "Unknown",
        domain=prospect.get("domain") or "",
        role=prospect.get("role") or "Unknown",
        country=prospect.get("country"),
        web_snippets=[],  # TODO: wire in real web search/page fetch (spec section 11)
    )
    prompt_body, prompt_version_id = active_prompt(repo.conn, org_id, campaign["id"], "research")
    output, meta = research.run(agent_input, org_id=org_id, system_prompt=prompt_body)
    log_agent_run(
        repo,
        cp_id=cp["id"],
        campaign_id=campaign["id"],
        agent="research",
        input_data=agent_input.model_dump(),
        output_data=output.model_dump(),
        reason=None,
        kb_chunk_ids=[],
        meta=meta,
        prompt_version_id=prompt_version_id,
    )
    repo.update(
        "campaign_prospects",
        cp["id"],
        {"stage": "researched", "research": output.model_dump(), "next_action_at": soon()},
    )


# ---------------------------------------------------------------------------
# researched -> qualified / disqualified / review
# ---------------------------------------------------------------------------


def _step_fitment(
    repo: OrgScopedRepo, cp: dict, campaign: dict, prospect: dict, org_id: str
) -> None:
    research_output = research.ResearchOutput.model_validate(cp.get("research") or {})
    role = prospect.get("role") or ""
    company = prospect.get("company") or ""
    icp_chunks = retrieval.retrieve(
        org_id, f"ICP fit for {role} at {company}", doc_types=["icp"], campaign_id=campaign["id"]
    )

    agent_input = fitment.FitmentInput(
        research=research_output,
        role=role,
        icp_chunks=icp_chunks,
        icp=campaign.get("icp") or {},
    )
    fit_threshold = campaign.get("fit_threshold") or 70
    prompt_body, prompt_version_id = active_prompt(repo.conn, org_id, campaign["id"], "fitment")
    output, meta = fitment.run(
        agent_input, fit_threshold=fit_threshold, org_id=org_id, system_prompt=prompt_body
    )
    log_agent_run(
        repo,
        cp_id=cp["id"],
        campaign_id=campaign["id"],
        agent="fitment",
        input_data=agent_input.model_dump(),
        output_data=output.model_dump(),
        reason=output.reason,
        kb_chunk_ids=[c.id for c in icp_chunks],
        meta=meta,
        prompt_version_id=prompt_version_id,
    )

    updates: dict = {"fit_verdict": output.verdict, "fit_score": output.score}
    if output.verdict == "fit":
        updates["stage"] = "qualified"
        updates["next_action_at"] = soon()
    elif output.verdict == "no_fit":
        updates["stage"] = "disqualified"
        updates["next_action_at"] = None
    else:  # "review" - too close to call automatically; a human decides
        repo.insert(
            "approvals", {"campaign_id": campaign["id"], "reason": "review", "status": "pending"}
        )
        updates["next_action_at"] = later(hours=_ESCALATION_RECHECK_HOURS)
    repo.update("campaign_prospects", cp["id"], updates)


# ---------------------------------------------------------------------------
# qualified and beyond -> Strategy decides
# ---------------------------------------------------------------------------


def _step_strategy(
    conn, repo: OrgScopedRepo, cp: dict, campaign: dict, prospect: dict, org_id: str
) -> None:
    touches = repo.list("touches", filters={"cp_id": cp["id"]}, order_by="created_at")
    prospect_summary = _prospect_summary(prospect, cp)
    timeline = _compact_timeline(touches)
    weekly_cap = (campaign.get("daily_limits") or {}).get("weekly_touch_cap", 3)
    week_ago = now() - timedelta(days=7)
    touches_this_week = sum(
        1 for t in touches if t["direction"] == "outbound" and t["created_at"] >= week_ago
    )
    playbook_chunks = retrieval.retrieve(
        org_id,
        retrieval.build_query(prospect_summary, "outreach strategy"),
        doc_types=["playbook"],
        campaign_id=campaign["id"],
    )

    agent_input = strategy.StrategyInput(
        prospect_summary=prospect_summary,
        timeline=timeline,
        channel_policy=campaign.get("channel_policy") or {},
        touches_this_week=touches_this_week,
        weekly_cap=weekly_cap,
        now=now().isoformat(),
        playbook_chunks=playbook_chunks,
    )
    prompt_body, prompt_version_id = active_prompt(repo.conn, org_id, campaign["id"], "strategy")
    output, meta = strategy.run(agent_input, org_id=org_id, system_prompt=prompt_body)
    strategy_run = log_agent_run(
        repo,
        cp_id=cp["id"],
        campaign_id=campaign["id"],
        agent="strategy",
        input_data=agent_input.model_dump(),
        output_data=output.model_dump(),
        reason=output.reason,
        kb_chunk_ids=[c.id for c in playbook_chunks],
        meta=meta,
        prompt_version_id=prompt_version_id,
    )

    if output.action in ("send", "call") and output.channel is None:
        # The model asked to act without naming a channel - treat as its own failure
        # mode rather than crashing on it.
        _escalate(repo, cp, campaign, reason="rule")
        return

    if output.action == "send":
        _execute_send(conn, repo, cp, campaign, prospect, org_id, output, strategy_run["id"])
    elif output.action == "call":
        _execute_call(conn, repo, cp, campaign, org_id, strategy_run["id"])
    elif output.action == "wait":
        hours = output.send_after_hours or _DEFAULT_RECHECK_HOURS
        repo.update("campaign_prospects", cp["id"], {"next_action_at": later(hours=hours)})
    elif output.action == "stop":
        repo.update("campaign_prospects", cp["id"], {"stage": "stopped", "next_action_at": None})
    elif output.action == "escalate":
        _escalate(repo, cp, campaign, reason="escalation")


def _escalate(repo: OrgScopedRepo, cp: dict, campaign: dict, *, reason: str) -> None:
    repo.insert(
        "approvals", {"campaign_id": campaign["id"], "reason": reason, "status": "pending"}
    )
    next_action_at = later(hours=_ESCALATION_RECHECK_HOURS)
    repo.update("campaign_prospects", cp["id"], {"next_action_at": next_action_at})


def _record_blocked_touch(
    repo: OrgScopedRepo,
    cp: dict,
    campaign: dict,
    channel: str,
    gate_result: GateResult,
    idempotency_key: str,
    agent_run_id: str,
) -> None:
    if repo.list("touches", filters={"idempotency_key": idempotency_key}):
        return
    repo.insert(
        "touches",
        {
            "cp_id": cp["id"],
            "step_number": cp.get("step_number") or 0,
            "channel": channel,
            "direction": "outbound",
            "kind": channel,
            "status": _DISPOSITION_TOUCH_STATUS[gate_result.disposition],
            "held_reason": gate_result.reason,
            "idempotency_key": idempotency_key,
            "agent_run_id": agent_run_id,
        },
    )
    if gate_result.disposition == "awaiting_approval":
        touch = repo.list("touches", filters={"idempotency_key": idempotency_key})[0]
        repo.insert(
            "approvals",
            {
                "touch_id": touch["id"],
                "campaign_id": campaign["id"],
                "reason": "rule",
                "status": "pending",
            },
        )


def _apply_disposition(repo: OrgScopedRepo, cp: dict, gate_result: GateResult) -> None:
    cp_id = cp["id"]
    if gate_result.disposition == "cancelled":
        repo.update("campaign_prospects", cp_id, {"stage": "stopped", "next_action_at": None})
    elif gate_result.disposition == "rescheduled":
        next_at = later(hours=_RESCHEDULE_HOURS)
        repo.update("campaign_prospects", cp_id, {"next_action_at": next_at})
    elif gate_result.disposition == "awaiting_approval":
        next_at = later(hours=_ESCALATION_RECHECK_HOURS)
        repo.update("campaign_prospects", cp_id, {"next_action_at": next_at})
    else:  # held
        next_at = later(minutes=_HELD_RECHECK_MINUTES)
        repo.update("campaign_prospects", cp_id, {"next_action_at": next_at})


def _execute_send(
    conn,
    repo: OrgScopedRepo,
    cp: dict,
    campaign: dict,
    prospect: dict,
    org_id: str,
    strategy_output,
    agent_run_id: str,
) -> None:
    idempotency_key = f"{cp['id']}:{cp.get('step_number') or 0}"
    action = Action(agent="strategy", channel=strategy_output.channel)
    gate_result = check_gate(conn, org_id, cp["id"], action)
    if not gate_result.allowed:
        _record_blocked_touch(
            repo, cp, campaign, strategy_output.channel, gate_result, idempotency_key, agent_run_id
        )
        _apply_disposition(repo, cp, gate_result)
        return

    if repo.list("touches", filters={"idempotency_key": idempotency_key}):
        return  # already sent (crash/retry) - never send the same step twice

    profile_rows = repo.list("company_profiles")
    profile = profile_rows[0] if profile_rows else {}
    prospect_summary = _prospect_summary(prospect, cp)

    kb_chunks = retrieval.retrieve(
        org_id,
        retrieval.build_query(prospect_summary, strategy_output.intent),
        doc_types=["case_study", "example_message", "product_sheet", "faq"],
        campaign_id=campaign["id"],
    )
    facts = [Fact.model_validate(f) for f in (cp.get("research") or {}).get("facts", [])]

    personalisation_input = personalisation.PersonalisationInput(
        facts=facts,
        intent=strategy_output.intent,
        channel=strategy_output.channel,
        tone=profile.get("default_tone") or "professional",
        language=(profile.get("languages") or ["en"])[0],
        rep_signature=profile.get("company_name") or "The team",
        sender_footer=profile.get("sender_footer") or "",
        kb_chunks=kb_chunks,
    )
    prompt_body, prompt_version_id = active_prompt(
        repo.conn, org_id, campaign["id"], "personalisation"
    )
    draft, p_meta = personalisation.run(
        personalisation_input, org_id=org_id, system_prompt=prompt_body
    )
    log_agent_run(
        repo,
        cp_id=cp["id"],
        campaign_id=campaign["id"],
        agent="personalisation",
        input_data=personalisation_input.model_dump(),
        output_data=draft.model_dump(),
        reason=None,
        kb_chunk_ids=[c.id for c in kb_chunks],
        meta=p_meta,
        prompt_version_id=prompt_version_id,
    )

    grounding_output, _g_meta = check_grounding(draft.body, kb_chunks, org_id=org_id)
    risky = forces_escalation(grounding_output)
    if risky or not grounding_output.all_supported:
        reason = "Risky topic flagged" if risky else "Message not fully grounded"
        repo.insert(
            "touches",
            {
                "cp_id": cp["id"],
                "step_number": cp.get("step_number") or 0,
                "channel": strategy_output.channel,
                "direction": "outbound",
                "kind": strategy_output.channel,
                "status": "awaiting_approval",
                "held_reason": reason,
                "subject": draft.subject,
                "body": draft.body,
                "grounded": grounding_output.all_supported,
                "idempotency_key": idempotency_key,
                "agent_run_id": agent_run_id,
            },
        )
        touch = repo.list("touches", filters={"idempotency_key": idempotency_key})[0]
        repo.insert(
            "approvals",
            {
                "touch_id": touch["id"],
                "campaign_id": campaign["id"],
                "reason": "pricing" if risky else "ungrounded",
                "status": "pending",
            },
        )
        next_at = later(hours=_ESCALATION_RECHECK_HOURS)
        repo.update("campaign_prospects", cp["id"], {"next_action_at": next_at})
        return

    touch_data: dict = {
        "cp_id": cp["id"],
        "step_number": cp.get("step_number") or 0,
        "channel": strategy_output.channel,
        "direction": "outbound",
        "kind": strategy_output.channel,
        "subject": draft.subject,
        "body": draft.body,
        "grounded": True,
        "idempotency_key": idempotency_key,
        "agent_run_id": agent_run_id,
    }

    integration = _live_integration(repo, strategy_output.channel)
    recipient = prospect.get(_RECIPIENT_FIELD.get(strategy_output.channel, ""))

    if integration is None:
        # No live integration configured - sandbox mode (spec section 8): recorded,
        # never transmitted.
        touch_data["status"] = "sent"
        touch_data["sent_at"] = now()
    elif not recipient:
        touch_data["status"] = "failed"
        touch_data["held_reason"] = f"No {strategy_output.channel} address on file"
    else:
        try:
            result = _send_via_channel(
                integration, strategy_output.channel, recipient, draft.subject, draft.body, profile
            )
            touch_data["status"] = "sent"
            touch_data["sent_at"] = now()
            touch_data["provider_id"] = result.provider_id
            touch_data["thread_key"] = result.thread_key
        except ChannelSendError as exc:
            touch_data["status"] = "failed"
            touch_data["held_reason"] = str(exc)[:500]

    repo.insert("touches", touch_data)

    if touch_data["status"] == "failed":
        # A real delivery failure - back off and let Strategy re-evaluate on the next
        # pass, rather than advancing the funnel on a message that never left.
        repo.update(
            "campaign_prospects",
            cp["id"],
            {
                "failures": (cp.get("failures") or 0) + 1,
                "next_action_at": later(hours=_RESCHEDULE_HOURS),
            },
        )
        return

    new_stage = "contacted" if cp["stage"] == "qualified" else cp["stage"]
    hours = strategy_output.send_after_hours or _DEFAULT_RECHECK_HOURS
    repo.update(
        "campaign_prospects",
        cp["id"],
        {
            "stage": new_stage,
            "step_number": (cp.get("step_number") or 0) + 1,
            "next_action_at": later(hours=hours),
        },
    )


def _execute_call(
    conn, repo: OrgScopedRepo, cp: dict, campaign: dict, org_id: str, agent_run_id: str
) -> None:
    idempotency_key = f"{cp['id']}:{cp.get('step_number') or 0}"
    action = Action(agent="strategy", channel="call")
    gate_result = check_gate(conn, org_id, cp["id"], action)
    if not gate_result.allowed:
        _record_blocked_touch(
            repo, cp, campaign, "call", gate_result, idempotency_key, agent_run_id
        )
        _apply_disposition(repo, cp, gate_result)
        return

    if repo.list("touches", filters={"idempotency_key": idempotency_key}):
        return

    # No voice provider is wired yet (spec section 12.7 / backend/channels/) - record
    # the call as held rather than pretending to place it.
    repo.insert(
        "touches",
        {
            "cp_id": cp["id"],
            "step_number": cp.get("step_number") or 0,
            "channel": "call",
            "direction": "outbound",
            "kind": "call",
            "status": "held",
            "held_reason": "Voice channel not connected yet",
            "idempotency_key": idempotency_key,
            "agent_run_id": agent_run_id,
        },
    )
    next_at = later(hours=_DEFAULT_RECHECK_HOURS)
    repo.update("campaign_prospects", cp["id"], {"next_action_at": next_at})
