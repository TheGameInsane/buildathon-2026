"""Per-organization monthly AI budget (spec sections 5 and 12.1): `call_structured`
checks this before every model call, so a budget hold happens before spend, not after.
The org's remaining budget is `organizations.monthly_budget_usd` minus this calendar
month's `sum(agent_runs.cost_usd)` — there is no separate running-total column to drift
out of sync with the ledger.
"""

from __future__ import annotations

from dataclasses import dataclass

from db.connection import org_connection


class BudgetExceededError(Exception):
    """Raised when an organization has no remaining monthly AI budget. Callers (the
    orchestrator) turn this into a `held` action with the budget reason (spec section
    8) — never a crash."""

    def __init__(self, org_id: str, spent_usd: float, budget_usd: float) -> None:
        self.org_id = org_id
        self.spent_usd = spent_usd
        self.budget_usd = budget_usd
        super().__init__(
            f"org {org_id} has spent ${spent_usd:.2f} of its ${budget_usd:.2f} monthly AI budget"
        )


@dataclass
class BudgetStatus:
    budget_usd: float | None  # None = unlimited (organizations.monthly_budget_usd is null)
    spent_usd: float
    remaining_usd: float | None  # None = unlimited


def get_budget_status(org_id: str) -> BudgetStatus:
    """Sums this calendar month's agent_runs.cost_usd for the org and compares it to
    organizations.monthly_budget_usd. Uses `org_connection`, so RLS scopes the read to
    this org even though the query below also filters by org_id explicitly."""
    with org_connection(org_id) as conn:
        org_row = conn.execute(
            "select monthly_budget_usd from organizations where id = %s", (org_id,)
        ).fetchone()
        if org_row is None:
            # The caller already resolved this org_id via an authenticated API key, so
            # a missing row here means an internal invariant broke, not a bad request.
            raise ValueError(f"organization {org_id!r} does not exist")

        spent_row = conn.execute(
            """
            select coalesce(sum(cost_usd), 0) as spent
            from agent_runs
            where org_id = %s and created_at >= date_trunc('month', now())
            """,
            (org_id,),
        ).fetchone()

    budget = (
        float(org_row["monthly_budget_usd"]) if org_row["monthly_budget_usd"] is not None else None
    )
    spent = float(spent_row["spent"])
    remaining = None if budget is None else max(budget - spent, 0.0)
    return BudgetStatus(budget_usd=budget, spent_usd=spent, remaining_usd=remaining)


def check_budget(org_id: str) -> BudgetStatus:
    """Raises BudgetExceededError if the org has no remaining budget this month."""
    status = get_budget_status(org_id)
    if status.remaining_usd is not None and status.remaining_usd <= 0:
        raise BudgetExceededError(org_id, status.spent_usd, status.budget_usd)
    return status
