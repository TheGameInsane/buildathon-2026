"""Inbound webhook routes (spec sections 9-11): a reply's entry point when it comes
from a provider (WhatsApp, the voice provider) rather than a human calling the API
directly. Each URL carries an opaque per-integration token that resolves the org
(tenancy.auth.resolve_org_by_webhook_token) before any org context exists — the same
bootstrap problem api-key auth solves, just for providers instead of humans.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from agents import voice
from api.errors import api_error
from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.common import log_agent_run, now
from orchestrator.inbound import handle_inbound_reply
from tenancy.auth import resolve_org_by_webhook_token

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _resolve_org_or_404(integration_token: str) -> str:
    org_id = resolve_org_by_webhook_token(integration_token)
    if org_id is None:
        raise api_error(404, "unknown_webhook_token", "No integration found for this token")
    return org_id


def _is_duplicate(org_id: str, provider: str, external_id: str | None, payload: dict) -> bool:
    """Inbound idempotency (spec section 9): duplicate deliveries are ignored, not
    reprocessed. No external_id to dedupe on (some test/dev payloads) always processes."""
    if not external_id:
        return False
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        if repo.list("webhook_events", filters={"provider": provider, "external_id": external_id}):
            return True
        repo.insert(
            "webhook_events",
            {
                "provider": provider,
                "external_id": external_id,
                "payload": payload,
                "processed_at": now(),
            },
        )
    return False


@router.post("/whatsapp/{integration_token}")
async def whatsapp_inbound(integration_token: str, request: Request) -> dict:
    org_id = _resolve_org_or_404(integration_token)
    # TODO: validate the X-Twilio-Signature header once a real Twilio auth token is
    # ever stored via PUT /integrations/twilio_whatsapp - there's nothing to validate
    # against yet (backend/channels/ is unbuilt).
    form = await request.form()
    payload = {key: str(value) for key, value in form.items()}
    external_id = payload.get("MessageSid")

    if _is_duplicate(org_id, "whatsapp", external_id, payload):
        return {"status": "duplicate_ignored"}

    from_number = payload.get("From", "").removeprefix("whatsapp:")
    handle_inbound_reply(
        org_id,
        channel="whatsapp",
        from_identifier=from_number,
        text=payload.get("Body", ""),
        provider_id=external_id,
    )
    return {"status": "received"}


class VoiceWebhookBody(BaseModel):
    """Provisional shape — DronaHQ's actual voice-agent webhook contract hasn't been
    verified yet (spec section 12.7 flags this explicitly as something to confirm
    early). Adjust the field names here once confirmed; nothing else needs to change."""

    event: str  # "answered" | "tool_call" | "ended"
    call_id: str
    cp_id: str | None = None
    transcript: str | None = None


@router.post("/voice/{integration_token}")
def voice_call_event(integration_token: str, body: VoiceWebhookBody) -> dict:
    org_id = _resolve_org_or_404(integration_token)
    if _is_duplicate(org_id, "dronahq_voice", f"{body.call_id}:{body.event}", body.model_dump()):
        return {"status": "duplicate_ignored"}

    if body.event != "ended" or not body.cp_id or not body.transcript:
        # "answered" needs no state change; a real "tool_call" for book_meeting comes
        # through the dedicated /tool endpoint below instead.
        return {"status": "ignored", "event": body.event}

    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        cp = repo.get("campaign_prospects", body.cp_id)  # 404s if not this org's

        extraction_input = voice.VoiceExtractionInput(transcript=body.transcript)
        output, meta = voice.run(extraction_input, org_id=org_id)
        agent_run = log_agent_run(
            repo,
            cp_id=cp["id"],
            campaign_id=cp["campaign_id"],
            agent="voice",
            input_data=extraction_input.model_dump(),
            output_data=output.model_dump(),
            reason=output.next_step,
            kb_chunk_ids=[],
            meta=meta,
        )
        repo.insert(
            "touches",
            {
                "cp_id": cp["id"],
                "step_number": cp.get("step_number") or 0,
                "channel": "call",
                "direction": "inbound",
                "kind": "call",
                "status": "received",
                "body": body.transcript,
                "provider_id": body.call_id,
                "agent_run_id": agent_run["id"],
            },
        )
        new_stage = "meeting" if output.qualified and output.meeting_time else cp["stage"]
        repo.update("campaign_prospects", cp["id"], {"stage": new_stage, "next_action_at": now()})

    return {"status": "processed", "outcome": output.outcome}


class BookMeetingRequest(BaseModel):
    cp_id: str
    meeting_time: str  # ISO 8601 - whatever time the voice agent negotiated


@router.post("/voice/{integration_token}/tool")
def voice_book_meeting(integration_token: str, body: BookMeetingRequest) -> dict:
    org_id = _resolve_org_or_404(integration_token)
    with org_connection(org_id) as conn:
        repo = OrgScopedRepo(conn, org_id)
        cp = repo.get("campaign_prospects", body.cp_id)  # 404s if not this org's
        # No calendar integration exists yet (spec section 12.7 / backend/channels/) -
        # this records the meeting on the timeline without checking free/busy or
        # creating a real calendar event; the spec's own fallback is a booking link.
        repo.insert(
            "touches",
            {
                "cp_id": cp["id"],
                "step_number": cp.get("step_number") or 0,
                "channel": "call",
                "direction": "system",
                "kind": "meeting",
                "status": "sent",
                "scheduled_for": body.meeting_time,
            },
        )
        repo.update("campaign_prospects", cp["id"], {"stage": "meeting", "next_action_at": now()})
    return {"status": "booked"}
