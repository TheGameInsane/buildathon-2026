"""The org-scoped repository helper (spec section 5, enforcement layer 2 — the layer
that is the real guarantee if the DB connection ever turns out to bypass RLS).

Every query against a tenant table must go through `OrgScopedRepo`. `org_id` is fixed
at construction time from the authenticated request's `OrgContext` and is injected into
every filter and every insert; it is never accepted from caller-supplied data, so a
handler cannot be tricked into reading or writing another organization's rows even by
passing a different `org_id` in a request body.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg import sql


class NotFound(Exception):
    """A row does not exist for this organization — including when it exists for a
    different one. Callers turn this into a 404 without ever revealing whether the id
    belongs to someone else."""


# Every tenant table from the migrations (org_id present on every row, either always
# set or, for the platform-shared tables, set here on every insert). `organizations`
# itself is deliberately not here: it has no org_id column, it IS the tenant.
TENANT_TABLES = frozenset(
    {
        "org_members",
        "company_profiles",
        "integrations",
        "org_controls",
        "api_keys",
        "reps",
        "campaign_templates",
        "campaigns",
        "rep_campaigns",
        "prompt_versions",
        "campaign_agents",
        "prospects",
        "campaign_prospects",
        "agent_runs",
        "touches",
        "approvals",
        "conflicts",
        "suppression",
        "kb_documents",
        "kb_chunks",
        "eval_sets",
        "eval_results",
        "activity_log",
        "webhook_events",
    }
)


def _table_identifier(table: str) -> sql.Identifier:
    if table not in TENANT_TABLES:
        raise ValueError(f"{table!r} is not a recognised org-scoped table")
    return sql.Identifier(table)


@dataclass
class OrgScopedRepo:
    conn: psycopg.Connection
    org_id: str

    def list(
        self,
        table: str,
        filters: dict[str, Any] | None = None,
        order_by: str | None = None,
    ) -> list[dict]:
        """Empty result is `[]`, never an error — matches the empty-state rule."""
        ident = _table_identifier(table)
        conditions = [sql.SQL("org_id = %s")]
        params: list[Any] = [self.org_id]
        for column, value in (filters or {}).items():
            conditions.append(sql.SQL("{} = %s").format(sql.Identifier(column)))
            params.append(value)
        query = sql.SQL("select * from {table} where {where}").format(
            table=ident, where=sql.SQL(" and ").join(conditions)
        )
        if order_by:
            query += sql.SQL(" order by {}").format(sql.Identifier(order_by))
        return self.conn.execute(query, params).fetchall()

    def get(self, table: str, row_id: Any) -> dict:
        ident = _table_identifier(table)
        row = self.conn.execute(
            sql.SQL("select * from {table} where org_id = %s and id = %s").format(table=ident),
            (self.org_id, row_id),
        ).fetchone()
        if row is None:
            raise NotFound(f"{table} {row_id!r} not found for this organization")
        return row

    def insert(self, table: str, data: dict[str, Any]) -> dict:
        ident = _table_identifier(table)
        payload = {**data, "org_id": self.org_id}
        columns = list(payload)
        query = sql.SQL("insert into {table} ({cols}) values ({vals}) returning *").format(
            table=ident,
            cols=sql.SQL(", ").join(sql.Identifier(c) for c in columns),
            vals=sql.SQL(", ").join(sql.Placeholder() for _ in columns),
        )
        return self.conn.execute(query, [payload[c] for c in columns]).fetchone()

    def update(self, table: str, row_id: Any, data: dict[str, Any]) -> dict:
        ident = _table_identifier(table)
        payload = {k: v for k, v in data.items() if k != "org_id"}  # org_id is immutable
        if not payload:
            return self.get(table, row_id)
        set_clause = sql.SQL(", ").join(
            sql.SQL("{} = %s").format(sql.Identifier(c)) for c in payload
        )
        query = sql.SQL(
            "update {table} set {set_clause} where org_id = %s and id = %s returning *"
        ).format(table=ident, set_clause=set_clause)
        row = self.conn.execute(
            query, [*payload.values(), self.org_id, row_id]
        ).fetchone()
        if row is None:
            raise NotFound(f"{table} {row_id!r} not found for this organization")
        return row

    def delete(self, table: str, row_id: Any) -> None:
        ident = _table_identifier(table)
        cursor = self.conn.execute(
            sql.SQL("delete from {table} where org_id = %s and id = %s").format(table=ident),
            (self.org_id, row_id),
        )
        if cursor.rowcount == 0:
            raise NotFound(f"{table} {row_id!r} not found for this organization")
