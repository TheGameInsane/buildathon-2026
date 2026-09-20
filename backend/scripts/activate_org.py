"""Dev/ops tool: promote an org from `sandbox_only` to `active` (spec section 5 — a
platform admin approves a tenant into production; `org_active_for_live` in
`api/campaigns.py`'s preflight reads this). There is no self-service route for a
tenant to do this to its own org (`PATCH /org` explicitly excludes `status` -
api/org.py), and no platform-admin UI exists yet either - `PATCH /platform/orgs/{id}`
is the real route this mirrors, for whenever one does. Until then, this is the way.

Usage: `cd backend && python -m scripts.activate_org <org-slug-or-id>`
Needs `DATABASE_URL` pointed at the migration-owning role, same as `db.migrate`.
"""

from __future__ import annotations

import sys

import psycopg
from dotenv import load_dotenv
from psycopg.rows import dict_row

from db.migrate import migrations_database_url


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: python -m scripts.activate_org <org-slug-or-id>", file=sys.stderr)
        raise SystemExit(1)

    load_dotenv(override=True)
    identifier = sys.argv[1]

    # The schema-owning role (same one db.migrate uses) - app_user is RLS-restricted to
    # one org at a time via app.org_id and could never see/update an arbitrary org row.
    with psycopg.connect(migrations_database_url(), row_factory=dict_row, autocommit=True) as conn:
        row = conn.execute(
            "update organizations set status = 'active' "
            "where slug = %s or id::text = %s returning id, name, slug, status",
            (identifier, identifier),
        ).fetchone()

    if row is None:
        print(f"No organization matches {identifier!r}", file=sys.stderr)
        raise SystemExit(1)

    print(f"{row['name']} ({row['slug']}) is now {row['status']}")


if __name__ == "__main__":
    main()
