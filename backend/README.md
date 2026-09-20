# Backend — Autonomous SDR Platform

Stack: **Python + FastAPI** (see root `CLAUDE.md` and `docs/spec.md` section 3).

## Overview

Multi-tenant Autonomous SDR platform backend: a REST API for the DronaHQ control plane and a
worker process that advances prospects through their campaigns. See `docs/spec.md` for the full
product and architecture spec.

## Folder structure

```
/backend
  /api            routes: org, campaigns, prospects, prompts, controls, reps, inbox, kb, integrations, webhooks
  /tenancy        org context, auth (api keys, roles), scoped repositories, secrets encryption
  /agents         one module per agent + schemas + default prompt templates
  /ai             llm wrapper, model routing, cost table, budget checks
  /orchestrator   worker, scheduler, step machine, policy_gate
  /channels       email, whatsapp, voice (provider interface), linkedin_sim, calendar
  /rag            ingestion (files, URLs, text), retrieval, grounding check
  /eval           golden sets, runners, llm_judge
  /db             models, migrations, seed
  /tests          shared tests (per-package tests may also live alongside their package)
  main.py         FastAPI app entrypoint
```

Folder ownership is defined in the root `CLAUDE.md`.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env   # fill in real values, never commit .env
```

## Environment variables

See `.env.example` for the full list: app config, `DATABASE_URL` (schema-owning
connection, Supabase Postgres + pgvector), `APP_DATABASE_URL` (the non-RLS-bypassing
`app_user` role the API and worker actually connect as), `SECRETS_KEY` (AES-GCM
credential encryption), and the LLM wrapper's `LLM_BASE_URL` / `LLM_API_KEY` /
`MODEL_SMALL` / `MODEL_STRONG` / `EMBED_MODEL`.

## Database

Migrations are plain SQL in `db/migrations/`, applied in filename order and tracked in
`schema_migrations`:

```bash
python -m db.migrate
```

This creates the tenancy and sales-domain tables, enables row-level security (every
tenant table's policy checks `org_id = current_setting('app.org_id')`), and creates the
`app_user` role the app connects as (set its password once, out of band, and put the
resulting connection string in `APP_DATABASE_URL` — never in a migration file).

Application code never queries a tenant table directly: everything goes through
`db.repository.OrgScopedRepo`, constructed with the `org_id` that `tenancy.auth`
resolved from the caller's API key. See `docs/spec.md` section 5 for why both layers
(the repository *and* RLS) exist.

## Running

```bash
uvicorn main:app --reload --port 8000
```

`GET /health` is available with no auth or dependencies.

## Lint and test

```bash
ruff check .
pytest
```

The tenancy/db tests spin up a private, throwaway Postgres cluster for the session
(via `initdb`/`pg_ctl`, already required to run Postgres locally — no Docker, no root)
so tenant isolation is proven against real row-level security. If the `vector`
extension isn't installed on the machine running the tests, the one test that needs it
is skipped with a clear reason; it isn't a codepath skipped anywhere else, including on
Supabase, which always has pgvector.
