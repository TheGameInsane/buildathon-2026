# Drona — Autonomous SDR Platform

Multi-tenant platform where any B2B company can spin up a workspace, describe what it
sells, upload its knowledge, connect its outreach channels, and run autonomous SDR
campaigns while a human manager stays in control. Built for the Inter Guild Buildathon
2026 (Tech Contingent IIT Madras × DronaHQ).

See `docs/spec.md` for the full product/architecture spec and `docs/api_contract.md`
for the REST contract between frontend and backend. Root `CLAUDE.md` defines folder
ownership and the non-negotiable engineering rules (tenant isolation, the policy gate,
the LLM wrapper, etc.) that both halves of this repo are built against.

## Repo layout

```
backend/    Python + FastAPI API, orchestrator/worker, AI agents, RAG, evals
frontend/   React + TypeScript console (campaigns, inbox, prompt studio, settings)
docs/       product spec, API contract, sample data
```

The two apps are independent: the frontend talks to the backend only over the HTTP API
described in `docs/api_contract.md`, and each has its own dependencies, env file, and
README with day-to-day commands.

---

## Backend (`backend/`)

**Stack:** Python 3.11+, FastAPI, Postgres (Supabase + pgvector), psycopg.

A REST API plus a worker/orchestrator that moves prospects through a campaign
lifecycle: research → qualify → decide next action → send/call → handle replies →
follow up, with every AI decision passing through a shared LLM wrapper and every
outbound action passing through a policy gate.

- `api/` — HTTP routes: auth, org, campaigns, prospects, agents, prompts, kb, inbox,
  controls, integrations, reps, suppression, webhooks, platform.
- `tenancy/` — API-key auth, org context resolution, encrypted credential storage.
- `db/` — SQL migrations, connection helpers, and `OrgScopedRepo`, the only sanctioned
  way to touch a tenant table (every tenant table also carries a Postgres row-level
  security policy, so isolation is enforced twice).
- `ai/` — `call_structured()`, the single choke point every LLM call goes through
  (retries, schema validation, cost tracking, budget gate). Never call an LLM SDK
  directly outside this module.
- `agents/` — one pure function per specialist (research, fitment, strategy,
  personalisation, conversation, follow-up, voice): typed input → (typed output, run
  metadata), no DB access inside an agent.
- `rag/` — chunking, ingestion, org/campaign-scoped retrieval, and the pre-send
  grounding check that fact-checks a drafted message against its cited sources.
- `orchestrator/` — the worker/scheduler that drives prospects through their stages
  and `policy_gate.check_gate()`, which every external action (send, call) must pass.
- `channels/` — email and WhatsApp adapters behind a common interface.
- `eval/` — labelled-set runners and an LLM-judge for scoring prompt versions.
- `tests/` — pytest suite covering the gate, the LLM wrapper, tenancy/RLS, and each
  agent's overrides.

### Run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env        # fill in real values, never commit .env

python -m db.migrate        # apply migrations (needs a schema-owning DATABASE_URL)
uvicorn main:app --reload --port 8000
```

```bash
pytest                      # tenancy/db tests spin up their own throwaway Postgres
ruff check .
```

To unblock a new org past the sandbox-only preflight check (no self-serve/admin route
for this yet):

```bash
python -m scripts.activate_org <org-slug-or-id>
```

Full details, env vars, and the schema story are in `backend/README.md`.

---

## Frontend (`frontend/`)

**Stack:** React 19 + TypeScript, Vite, React Router, TanStack Query, Tailwind CSS v4,
Radix UI / shadcn-style primitives, react-hook-form + zod, Recharts.

The web console a tenant's team uses day to day: launch and monitor campaigns, review
and edit agent-drafted messages, manage the shared inbox, tune prompts, and configure
company profile, reps, integrations and suppression lists.

- `src/api/` — fetch wrappers per resource (campaigns, prospects, inbox, prompts, ...).
- `src/hooks/` — TanStack Query hooks built on top of `src/api`.
- `src/pages/` — route-level views: campaigns list/detail (tabs for overview, agents,
  knowledge, prompts, prospects, settings), the new-campaign wizard, inbox, prospect
  360, prompt studio, compare, settings, login/register.
- `src/components/` — shared UI, with `components/ui` holding shadcn-style primitives.
- `src/mocks/` — mock data the API layer reads from until a given backend endpoint is
  wired up.
- `src/lib/` — shared utilities (auth context, formatting, design tokens).

### Run it

```bash
cd frontend
cp .env.example .env        # point at the backend's URL
npm install
npm run dev                 # start the Vite dev server
```

```bash
npm run build                # tsc -b then production build to dist/
npm run preview              # preview the production build
npm run lint
```

Routes are gated by `RequireAuth`, which redirects to `/login` when no user is signed
in. More detail is in `frontend/README.md`.

---

## How they fit together

The frontend is a thin client over the backend's REST API (see `docs/api_contract.md`);
it holds no tenant data, credentials, or business logic of its own — company identity,
knowledge, and outreach content all come from the backend at request time, scoped to
the calling org. Run the backend first (`uvicorn main:app --reload --port 8000`), then
the frontend (`npm run dev`), with `CORS_ORIGINS` on the backend covering the frontend's
dev origin (defaults already cover the standard Vite ports).
