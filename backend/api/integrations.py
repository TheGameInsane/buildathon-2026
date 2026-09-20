"""Integration routes (spec sections 10 and 11): connecting a channel provider.
Credentials are encrypted at rest and never returned by any API (CLAUDE.md
non-negotiable) — `GET /integrations` reports status only. New integrations start in
`sandbox` mode (spec section 5). Connecting one is also where a webhook's URL comes
from: `webhook_token` is what `/webhooks/{provider}/{token}` resolves back to this org.
"""

from __future__ import annotations

import json
import secrets

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from api.deps import RequestContext, get_ctx
from api.errors import api_error
from channels import email as channels_email
from channels import whatsapp as channels_whatsapp
from orchestrator.common import now
from tenancy.crypto import decrypt_secret, encrypt_secret

router = APIRouter(tags=["integrations"])

_PROVIDERS = {
    "email_smtp_imap", "gmail_oauth", "twilio_whatsapp", "dronahq_voice",
    "google_calendar", "web_search", "enrichment",
}  # fmt: skip

# Provider -> the /webhooks/{path}/{token} segment that provider's events arrive on.
_WEBHOOK_PATHS = {"twilio_whatsapp": "whatsapp", "dronahq_voice": "voice"}

# Provider -> a live connectivity check (channels/*.status). A provider with no entry
# here (voice, calendar, search, enrichment - none have an adapter yet) can only have
# its stored credentials confirmed present, not verified against the real service.
_STATUS_CHECKERS = {
    "email_smtp_imap": channels_email.status,
    "twilio_whatsapp": channels_whatsapp.status,
}


class IntegrationStatus(BaseModel):
    provider: str
    mode: str
    connected: bool
    detail: str
    last_checked_at: str | None = None


def _to_status(row: dict) -> IntegrationStatus:
    return IntegrationStatus(
        provider=row["provider"],
        mode=row["mode"],
        connected=row.get("status") == "connected",
        detail=row.get("status") or "not configured",
        last_checked_at=(
            row["last_checked_at"].isoformat() if row.get("last_checked_at") else None
        ),
    )


@router.get("/integrations", response_model=list[IntegrationStatus])
def list_integrations(ctx: RequestContext = Depends(get_ctx)) -> list[IntegrationStatus]:
    return [_to_status(row) for row in ctx.repo.list("integrations")]


class UpsertIntegrationRequest(BaseModel):
    config: dict = Field(default_factory=dict)
    mode: str = "sandbox"


class UpsertIntegrationResponse(IntegrationStatus):
    webhook_url: str | None = None


@router.put("/integrations/{provider}", response_model=UpsertIntegrationResponse)
def upsert_integration(
    provider: str, body: UpsertIntegrationRequest, ctx: RequestContext = Depends(get_ctx)
) -> UpsertIntegrationResponse:
    if provider not in _PROVIDERS:
        raise api_error(422, "unknown_provider", f"Unknown provider {provider!r}")

    encrypted = encrypt_secret(json.dumps(body.config))
    existing = ctx.repo.list("integrations", filters={"provider": provider})
    webhook_token = (
        existing[0]["webhook_token"]
        if existing and existing[0].get("webhook_token")
        else secrets.token_urlsafe(24)
    )
    data = {
        "config_encrypted": encrypted,
        "mode": body.mode,
        "webhook_token": webhook_token,
        "status": "configured",
    }
    row = (
        ctx.repo.update("integrations", existing[0]["id"], data)
        if existing
        else ctx.repo.insert("integrations", {"provider": provider, **data})
    )

    webhook_path = _WEBHOOK_PATHS.get(provider)
    webhook_url = f"/webhooks/{webhook_path}/{webhook_token}" if webhook_path else None
    return UpsertIntegrationResponse(**_to_status(row).model_dump(), webhook_url=webhook_url)


class TestResult(BaseModel):
    connected: bool
    detail: str


@router.post("/integrations/{provider}/test", response_model=TestResult)
def test_integration(provider: str, ctx: RequestContext = Depends(get_ctx)) -> TestResult:
    rows = ctx.repo.list("integrations", filters={"provider": provider})
    if not rows:
        raise api_error(404, "not_found", f"No integration configured for {provider!r}")
    integration = rows[0]

    status_check = _STATUS_CHECKERS.get(provider)
    if status_check is None:
        # No adapter exists for this provider yet (voice, calendar, search,
        # enrichment) - this can only confirm credentials are stored, not that they
        # work against the real service.
        connected, detail = True, "Credentials stored (not yet verified against the provider)"
    else:
        config = json.loads(decrypt_secret(integration["config_encrypted"]))
        connected, detail = status_check(config)

    updates = {"status": "connected" if connected else "error", "last_checked_at": now()}
    ctx.repo.update("integrations", integration["id"], updates)
    return TestResult(connected=connected, detail=detail)
