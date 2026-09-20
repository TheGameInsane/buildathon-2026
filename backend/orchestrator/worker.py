"""The worker (spec section 9): the only process that advances prospects. Claims due
rows fairly across organizations, steps each one, and never lets one campaign's or
one tenant's failure block another's.

IMAP polling (spec section 9's `poll_inboxes(every 30s)`) isn't implemented — there's
no email channel adapter yet (`backend/channels/`), so there's nothing to poll.
"""

from __future__ import annotations

import logging
import time
from datetime import UTC, datetime, timedelta

from db.connection import org_connection
from db.repository import OrgScopedRepo
from orchestrator.scheduler import DueProspect, claim_due
from orchestrator.step import step

logger = logging.getLogger(__name__)

_POLL_INTERVAL_S = 3
_CLAIM_LIMIT = 10
_MAX_FAILURES_BEFORE_ESCALATION = 5


def _backoff_seconds(failures: int) -> float:
    """Exponential backoff, capped at 1 hour, so a persistently broken prospect
    doesn't spin the worker."""
    return min(60 * (2**failures), 3600)


def _handle_failure(due: DueProspect, exc: Exception) -> None:
    """A single prospect failing must never take down the worker loop or block other
    prospects (spec section 9's isolation rule)."""
    logger.exception("step failed for cp=%s org=%s", due.id, due.org_id)
    try:
        with org_connection(due.org_id) as conn:
            repo = OrgScopedRepo(conn, due.org_id)
            cp = repo.get("campaign_prospects", due.id)
            failures = (cp.get("failures") or 0) + 1
            updates: dict = {
                "failures": failures,
                "next_action_at": _later_seconds(_backoff_seconds(failures)),
            }
            repo.update("campaign_prospects", due.id, updates)
            repo.insert(
                "activity_log",
                {
                    "actor": "worker",
                    "campaign_id": due.campaign_id,
                    "cp_id": due.id,
                    "action": "step_failed",
                    "summary": str(exc)[:500],
                },
            )
            if failures >= _MAX_FAILURES_BEFORE_ESCALATION:
                repo.insert(
                    "approvals",
                    {"campaign_id": due.campaign_id, "reason": "escalation", "status": "pending"},
                )
    except Exception:  # noqa: BLE001 - logging the failure must never itself crash the loop
        logger.exception("failed to record failure for cp=%s org=%s", due.id, due.org_id)


def _later_seconds(seconds: float) -> datetime:
    return datetime.now(UTC) + timedelta(seconds=seconds)


def run_once(limit: int = _CLAIM_LIMIT) -> int:
    """Claims and steps one batch of due prospects. Returns how many were processed."""
    due_list = claim_due(limit=limit)
    for due in due_list:
        try:
            step(due.org_id, due.id)
        except Exception as exc:  # noqa: BLE001 - one prospect's failure is isolated here
            _handle_failure(due, exc)
    return len(due_list)


def run_forever() -> None:
    logger.info("worker starting, polling every %ss", _POLL_INTERVAL_S)
    while True:
        processed = run_once()
        if processed == 0:
            time.sleep(_POLL_INTERVAL_S)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run_forever()
