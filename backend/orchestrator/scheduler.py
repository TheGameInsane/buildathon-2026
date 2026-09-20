"""Cross-org scheduling (spec section 9). The worker needs to see due prospects across
every organization to schedule fairly, but the app's runtime role never bypasses RLS
(spec section 5). `claim_due_prospects` (db/migrations/0008_scheduling.sql) is a narrow
SECURITY DEFINER function — the only place this reaches across orgs — returning just
enough (ids) for the worker to open a properly org-scoped connection per row for the
actual work.
"""

from __future__ import annotations

from dataclasses import dataclass

from db.connection import app_connection


@dataclass
class DueProspect:
    id: str
    org_id: str
    campaign_id: str
    prospect_id: str
    stage: str


def claim_due(
    limit: int = 10, *, per_org_cap: int = 3, fetch_multiplier: int = 4
) -> list[DueProspect]:
    """Claims up to `limit` due campaign_prospects rows, ordered by next_action_at,
    capped at `per_org_cap` per organization so one tenant cannot starve the others.

    The underlying SQL function claims (leases) `limit * fetch_multiplier` rows so
    there's enough headroom to apply the per-org cap in Python; rows claimed but not
    selected here simply get retried when their 2-minute lease expires (a small
    scheduling delay, not lost or double-processed work).
    """
    with app_connection() as conn:
        rows = conn.execute(
            "select * from claim_due_prospects(%s)", (limit * fetch_multiplier,)
        ).fetchall()

    per_org_count: dict[str, int] = {}
    claimed: list[DueProspect] = []
    for row in rows:
        org_id = row["org_id"]
        if per_org_count.get(org_id, 0) >= per_org_cap:
            continue
        per_org_count[org_id] = per_org_count.get(org_id, 0) + 1
        claimed.append(DueProspect(**row))
        if len(claimed) >= limit:
            break
    return claimed
