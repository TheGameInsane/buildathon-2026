"""Prospect routes (spec section 10): adding a prospect to a campaign one at a time
or in bulk, ICP discovery, listing a campaign's prospects by stage, and one prospect's
cross-channel timeline (Prospect 360).
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from api.deps import RequestContext, get_ctx
from api.dronahq_discovery import (
    DiscoveryError,
    extract_prospects,
    invoke_discovery,
    simulate_discovery,
)
from api.errors import api_error

router = APIRouter(tags=["prospects"])

# How many simulated leads one "Discover prospects" click surfaces (docs/prospects.json
# has ~500 people per simulated ICP group) - small enough that a demo doesn't dump the
# whole pool in at once and swamp the worker's Strategy/Personalisation calls.
_DEMO_DISCOVERY_BATCH = 25

_PRESENTATION_PROSPECTS = [
    {
        "full_name": "Maya Patel",
        "email": "maya.patel@northstar.test",
        "phone": "+1 415 555 0148",
        "linkedin_url": "https://www.linkedin.com/in/maya-patel-cto",
        "company": "Northstar Cloud",
        "domain": "northstarcloud.test",
        "role": "Chief Technology Officer",
        "country": "United States",
    },
    {
        "full_name": "Ethan Brooks",
        "email": "ethan.brooks@vertex.test",
        "phone": "+1 212 555 0193",
        "linkedin_url": "https://www.linkedin.com/in/ethan-brooks-engineering",
        "company": "VertexIQ",
        "domain": "vertexiq.test",
        "role": "VP Engineering",
        "country": "United States",
    },
    {
        "full_name": "Sofia Martinez",
        "email": "sofia.martinez@arcgrid.test",
        "phone": "+1 512 555 0167",
        "linkedin_url": "https://www.linkedin.com/in/sofia-martinez-platform",
        "company": "ArcGrid",
        "domain": "arcgrid.test",
        "role": "Head of Platform",
        "country": "United States",
    },
    {
        "full_name": "Noah Williams",
        "email": "noah.williams@cloudframe.test",
        "phone": "+1 646 555 0134",
        "linkedin_url": "https://www.linkedin.com/in/noah-williams-technology",
        "company": "CloudFrame",
        "domain": "cloudframe.test",
        "role": "Chief Technology Officer",
        "country": "United States",
    },
    {
        "full_name": "Priya Desai",
        "email": "priya.desai@signalpath.test",
        "phone": "+1 312 555 0186",
        "linkedin_url": "https://www.linkedin.com/in/priya-desai-vpeng",
        "company": "SignalPath",
        "domain": "signalpath.test",
        "role": "VP Engineering",
        "country": "United States",
    },
    {
        "full_name": "Lucas Anderson",
        "email": "lucas.anderson@helixops.test",
        "phone": "+1 206 555 0172",
        "linkedin_url": "https://www.linkedin.com/in/lucas-anderson-platform",
        "company": "HelixOps",
        "domain": "helixops.test",
        "role": "Director of Platform Engineering",
        "country": "United States",
    },
]


class ProspectCreateRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    linkedin_url: str | None = None
    company: str | None = None
    domain: str | None = None
    role: str | None = None
    country: str | None = None


class CampaignProspect(BaseModel):
    id: str
    prospect_id: str
    stage: str
    fit_verdict: str | None
    fit_score: int | None
    full_name: str | None
    company: str | None
    role: str | None
    # Reference link only (spec: LinkedIn is not an outreach channel) — never sent to
    # or read from, just shown as a plain link on the prospect.
    linkedin_url: str | None = None


class DiscoveryImportResult(BaseModel):
    imported: int
    skipped: int
    prospects: list[CampaignProspect]


def _row_to_cp(row: dict) -> CampaignProspect:
    return CampaignProspect(
        id=str(row["id"]),
        prospect_id=str(row["prospect_id"]),
        stage=row["stage"],
        fit_verdict=row.get("fit_verdict"),
        fit_score=row.get("fit_score"),
        full_name=row.get("full_name"),
        company=row.get("company"),
        role=row.get("role"),
        linkedin_url=row.get("linkedin_url"),
    )


@router.post("/campaigns/{campaign_id}/prospects", response_model=CampaignProspect, status_code=201)
def add_prospect(
    campaign_id: str, body: ProspectCreateRequest, ctx: RequestContext = Depends(get_ctx)
) -> CampaignProspect:
    ctx.repo.get("campaigns", campaign_id)  # 404s if the campaign isn't this org's

    data = body.model_dump()
    prospect = None
    if data.get("email"):
        existing = ctx.repo.list("prospects", filters={"email": data["email"]})
        prospect = existing[0] if existing else None
    if prospect is None:
        prospect = ctx.repo.insert("prospects", data)

    row = ctx.repo.insert(
        "campaign_prospects", {"campaign_id": campaign_id, "prospect_id": prospect["id"]}
    )
    # `row` (campaign_prospects) must win on the overlapping `id` key - it's a
    # different row from `prospect`, and CampaignProspect.id means the cp id.
    return _row_to_cp({**prospect, **row})


_PROSPECT_FIELDS = set(ProspectCreateRequest.model_fields)


def _import_rows(
    ctx: RequestContext, campaign_id: str, rows: list[dict], *, source: str
) -> DiscoveryImportResult:
    """Shared by discovery import and bulk CSV/JSON import: dedupe each row against
    this org's existing prospects by email, then attach it to the campaign - idempotent
    on a re-run, same as discovery."""
    imported: list[CampaignProspect] = []
    skipped = 0
    for raw in rows:
        data = {k: v for k, v in raw.items() if k in _PROSPECT_FIELDS and v not in (None, "")}
        # Ignore malformed rows instead of storing an empty, unusable person record.
        if not data:
            skipped += 1
            continue
        prospect = None
        if data.get("email"):
            prospect = ctx.conn.execute(
                "select * from prospects where org_id = %s and lower(email) = lower(%s)",
                (ctx.org_id, data["email"]),
            ).fetchone()
        if prospect is None:
            prospect = ctx.repo.insert("prospects", {**data, "source": source})

        existing = ctx.conn.execute(
            """
            select * from campaign_prospects
            where org_id = %s and campaign_id = %s and prospect_id = %s
            """,
            (ctx.org_id, campaign_id, prospect["id"]),
        ).fetchone()
        if existing:
            skipped += 1
            continue
        row = ctx.repo.insert(
            "campaign_prospects", {"campaign_id": campaign_id, "prospect_id": prospect["id"]}
        )
        imported.append(_row_to_cp({**prospect, **row}))

    return DiscoveryImportResult(imported=len(imported), skipped=skipped, prospects=imported)


def _campaign_prospect_emails(ctx: RequestContext, campaign_id: str) -> set[str]:
    """Every email already attached to this campaign - `simulate_discovery` excludes
    these so a repeated click surfaces new people instead of re-serving the same batch
    (a real agent wouldn't keep resurfacing the same lead either)."""
    rows = ctx.conn.execute(
        "select p.email from campaign_prospects cp "
        "join prospects p on p.id = cp.prospect_id "
        "where cp.org_id = %s and cp.campaign_id = %s and p.email is not null",
        (ctx.org_id, campaign_id),
    ).fetchall()
    return {row["email"].lower() for row in rows}


@router.post("/campaigns/{campaign_id}/prospects/discover", response_model=DiscoveryImportResult)
def discover_prospects(
    campaign_id: str, ctx: RequestContext = Depends(get_ctx)
) -> DiscoveryImportResult:
    """Run the DronaHQ ICP agent, then persist its returned prospects for this campaign.

    Only the server calls the webhook, so the endpoint and its response never become
    browser-visible. Re-running discovery is idempotent for prospects with an email.

    No real DronaHQ agent is reachable until `DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL` is
    configured (unset by default - `invoke_discovery` would otherwise call a vendor
    URL that only times out here) - until then, `simulate_discovery`'s local synthetic
    dataset (docs/prospects.json) stands in for it.
    """
    campaign = ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's

    discovered: list[dict] = []
    if os.environ.get("DRONAHQ_ICP_DISCOVERY_WEBHOOK_URL"):
        request_payload = {
            "campaign_id": str(campaign["id"]),
            "campaign_name": campaign["name"],
            "icp": campaign.get("icp") or {},
            "target_roles": campaign.get("target_roles") or [],
            "languages": campaign.get("languages") or [],
        }
        try:
            raw = invoke_discovery(request_payload)
            discovered = extract_prospects(raw, org_id=str(ctx.org_id))
        except DiscoveryError as exc:
            raise api_error(502, "discovery_unavailable", str(exc)) from exc

    if not discovered:
        discovered = simulate_discovery(
            campaign_id,
            exclude_emails=_campaign_prospect_emails(ctx, campaign_id),
            limit=_DEMO_DISCOVERY_BATCH,
        )
    if not discovered:
        discovered = _PRESENTATION_PROSPECTS

    return _import_rows(ctx, campaign_id, discovered, source="dronahq_icp_discovery")


@router.post("/campaigns/{campaign_id}/prospects/import", response_model=DiscoveryImportResult)
def import_prospects(
    campaign_id: str, rows: list[ProspectCreateRequest], ctx: RequestContext = Depends(get_ctx)
) -> DiscoveryImportResult:
    """Bulk-add prospects from an uploaded CSV/JSON file - the frontend parses the file
    and posts the resulting rows here; this is just `POST .../prospects` in bulk, with
    the same email-based dedupe `discover_prospects` uses. Empty state (`rows: []`) is
    a no-op, not an error."""
    ctx.repo.get("campaigns", campaign_id)  # 404s if not this org's
    return _import_rows(ctx, campaign_id, [row.model_dump() for row in rows], source="csv_import")


@router.get("/campaigns/{campaign_id}/prospects", response_model=list[CampaignProspect])
def list_campaign_prospects(
    campaign_id: str, stage: str | None = None, ctx: RequestContext = Depends(get_ctx)
) -> list[CampaignProspect]:
    ctx.repo.get("campaigns", campaign_id)
    filters: dict = {"campaign_id": campaign_id}
    if stage:
        filters["stage"] = stage
    rows = ctx.conn.execute(
        """
        select cp.id, cp.prospect_id, cp.stage, cp.fit_verdict, cp.fit_score,
               p.full_name, p.company, p.role, p.linkedin_url
        from campaign_prospects cp
        join prospects p on p.id = cp.prospect_id
        where cp.org_id = %(org_id)s and cp.campaign_id = %(campaign_id)s
          and (%(stage)s::text is null or cp.stage = %(stage)s)
        order by cp.created_at
        """,
        {"org_id": ctx.org_id, "campaign_id": campaign_id, "stage": stage},
    ).fetchall()
    return [_row_to_cp(row) for row in rows]


class TimelineItem(BaseModel):
    id: str
    at: str
    channel: str | None
    direction: str
    kind: str | None
    status: str | None
    reason: str | None
    held_reason: str | None
    grounded: bool | None
    is_seeded: bool


@router.get("/prospects/{cp_id}/timeline", response_model=list[TimelineItem])
def get_timeline(cp_id: str, ctx: RequestContext = Depends(get_ctx)) -> list[TimelineItem]:
    cp = ctx.repo.get("campaign_prospects", cp_id)  # 404s if not this org's
    touches = ctx.repo.list("touches", filters={"cp_id": cp["id"]}, order_by="created_at")
    agent_runs = ctx.repo.list("agent_runs", filters={"cp_id": cp["id"]}, order_by="created_at")
    runs_by_id = {r["id"]: r for r in agent_runs}

    items = [
        TimelineItem(
            id=str(t["id"]),
            at=t["created_at"].isoformat(),
            channel=t.get("channel"),
            direction=t["direction"],
            kind=t.get("kind"),
            status=t.get("status"),
            reason=(runs_by_id.get(t.get("agent_run_id")) or {}).get("reason"),
            held_reason=t.get("held_reason"),
            grounded=t.get("grounded"),
            is_seeded=t.get("is_seeded", False),
        )
        for t in touches
    ]
    for r in agent_runs:
        items.append(
            TimelineItem(
                id=str(r["id"]),
                at=r["created_at"].isoformat(),
                channel=None,
                direction="system",
                kind=r["agent"],
                status=r["status"],
                reason=r.get("reason"),
                held_reason=None,
                grounded=None,
                is_seeded=r.get("is_seeded", False),
            )
        )
    items.sort(key=lambda item: item.at)
    return items
