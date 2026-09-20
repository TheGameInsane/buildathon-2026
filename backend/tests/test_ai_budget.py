"""ai/budget.py against a real Postgres (see conftest.py): the minimum needed to trust
the budget gate call_structured relies on before every model call."""

from __future__ import annotations

import pytest

from ai.budget import BudgetExceededError, check_budget, get_budget_status
from db.connection import org_connection


def test_null_budget_is_unlimited(two_orgs):
    org_a, _ = two_orgs
    status = get_budget_status(org_a.id)
    assert status.budget_usd is None
    assert status.remaining_usd is None
    check_budget(org_a.id)  # must not raise


def test_exhausted_budget_raises(two_orgs):
    org_a, _ = two_orgs
    with org_connection(org_a.id) as conn:
        conn.execute(
            "update organizations set monthly_budget_usd = 0 where id = %s", (org_a.id,)
        )

    with pytest.raises(BudgetExceededError):
        check_budget(org_a.id)
