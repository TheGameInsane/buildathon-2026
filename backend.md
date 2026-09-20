 ▐▛███▛█   Claude Code v2.1.278
▝▜██████▀  Sonnet 5 · Claude Pro
  ▝▝ ▝▝    ~/Codes/webdev/guild/drona

● AI layer is complete

  agents/ — all 7 agents from spec §12.3, each a pure function (typed input -> 
  (typed output, RunMeta)), each with its own default prompt template and a
  python -m agents.<name> CLI entry that runs on a sample input with no DB or 
  server:
  - research.py, fitment.py (verdict derived from score/fit_threshold in code,
    never trusted from the model), strategy.py, personalisation.py (temp 0.7,
    renders {{channel}}/{{intent}} into its own prompt), conversation.py
    (unsubscribe phrases force intent="unsubscribe" in code regardless of the
    model), follow_up.py (advisory-only, per spec), voice.py (post-call
    transcript extraction + the DronaHQ call-script template for later).
  - Shared: types.py (Fact, Chunk, Channel), prompt_render.py + prompts/*.md.

  rag/ — chunking.py (400-word/50-overlap split), ingest.py (checksum-deduped,
  embeds via ai.llm.embed, writes kb_documents/kb_chunks), retrieval.py
  (org+campaign-scoped pgvector search with a similarity floor), grounding.py
  (the pre-send fact-check guardrail, temp 0, with forces_escalation() for risky
  topics).

  eval/ — llm_judge.py (1-5 scoring on personalisation/accuracy/clarity/CTA) and
  runner.py + run.py CLI, covering the three eval types spec §12.8 names:
  fitment accuracy, reply-intent accuracy, personalisation quality via judge.

  A real bug I hit and fixed along the way: the budget gate I added earlier made
  call_structured hit Postgres on every call — which broke the CLI agent
  entries' explicit "no DB or server" requirement from agents/CLAUDE.md. Fixed
  by making org_id optional: None (the CLI/dev default) skips the budget check
  entirely; the orchestrator will always pass a real org_id in production, so
  nothing gets to spend unbudgeted for real.

  Verified: all modules import cleanly, ruff check . passes, pytest is 31 passed
  / 1 skipped (pgvector, same as before), and python -m agents.research now
  runs to the LLM call with zero DB dependency.

  Still not built: the orchestrator (nothing currently calls these agents — no
  worker, no policy_gate), and no API routes to expose any of this to the
  frontend. That's naturally the next piece if you want an actual click-through
  demo.

✻ Worked for 12m 30s · done 3:16 AM

❯ till now, whatever you have made in the backend, explain me in detail how is  
  each code in each file working and what purpose does it solve, and how will   
  the our final app work, as in how does the workflow from backend, through the 
  ai layer look like.                                                           

  Read 1 file (ctrl+o to expand)

● The backend, file by file, and how it all fits together

  1. The shape of it

  backend/
    db/          schema + the only way to touch a tenant table safely
    tenancy/     who's calling, and turning their key into an org_id
    api/         HTTP routes (only /health exists so far)
    ai/          the one gate every LLM call must pass through
    agents/      the 7 "brains" — pure functions, no DB, no side effects
    rag/         knowledge base: chunk it, embed it, retrieve it, fact-check
  against it
    eval/        scores prompt versions against labelled examples
    orchestrator/  <- empty. This is what's supposed to wire everything above
  together.
    channels/      <- empty. Email/WhatsApp/voice/LinkedIn adapters live here.

  Two layers are infrastructure (db, tenancy, ai) — every other layer depends on
  them. Three layers are domain logic (agents, rag, eval) — they depend on the
  infrastructure but not on each other except where the spec says so (fitment
  reads research's output type, strategy reads follow_up's output type as an
  advisory hint). Nothing calls any of the domain logic yet — that's
  orchestrator/'s job, and it doesn't exist.

  ---

  2. Foundation: db/ and tenancy/

  This is the part everything else stands on, so it's worth being precise about
  the mechanism.

  db/migrations/*.sql — seven plain SQL files, applied in order by
  db/migrate.py, each building on the last: extensions/roles → tenancy tables
  (organizations, api_keys, company_profiles...) → the sales domain (campaigns,
  prospects, campaign_prospects, agent_runs, touches...) → knowledge base
  (kb_documents, kb_chunks) → evals → webhook/activity plumbing. Every tenant
  table gets org_id uuid not null and a Postgres row-level security policy:
  org_id = current_setting('app.org_id'). This means even if application code
  forgets a WHERE org_id = ... clause, Postgres itself refuses to return another
  org's rows — enforcement lives in two independent places.

  db/connection.py — two ways to get a connection:
  - app_connection() — no org context set. Used only during auth, before we know
    who's calling (resolving an API key into an org_id).
  - org_connection(org_id) — opens a connection, then runs select 
    set_config('app.org_id', org_id, true) inside the transaction. That
    set_config call is what makes the RLS policies above actually filter to this
    one org. Everything after auth uses this.

  db/repository.py — OrgScopedRepo. This is the layer 2 enforcement (RLS is
  layer 3, defence in depth). It's constructed once per request with the org_id
  resolved from the caller's API key, and that org_id is baked in — a handler
  can't pass a different org_id in a request body and read someone else's data,
  because OrgScopedRepo never reads org_id from anywhere except its own
  constructor. .list(), .get(), .insert(), .update(), .delete() all inject
  org_id into the query themselves. It also whitelists table names
  (TENANT_TABLES), so repo.list("organizations") (not a tenant table — it is the
  tenant) or repo.list("'; drop table x; --") both raise ValueError instead of
  running.

  tenancy/api_keys.py — a key is sdr_<random>, and only its SHA-256 hash is ever
  stored. create_api_key() returns the raw key once (caller must show it to the
  user immediately); resolve_api_key() looks it up by hash and returns (id, 
  org_id) — org_id=None means it's a platform-admin key.

  tenancy/auth.py — the FastAPI dependency, require_org(). Pulls Authorization: 
  Bearer ..., resolves it via resolve_api_key, and hands the route an
  OrgContext(org_id, api_key_id). require_platform_admin() is the same thing but
  rejects any key that has an org_id. resolve_org_by_webhook_token() is the
  equivalent for inbound webhooks (which carry an opaque token in the URL, not a
  bearer key).

  tenancy/crypto.py — AES-256-GCM, key from the SECRETS_KEY env var.
  encrypt_secret()/decrypt_secret() wrap integration credentials
  (integrations.config_encrypted) so a mailbox password or Twilio token never
  sits in the DB in plaintext.

  api/health.py, main.py — the FastAPI app currently exposes exactly one route,
  /health, no auth. Everything else is unbuilt.

  ---

  3. The AI layer's foundation: ai/

  This is the choke point spec §12.1 demands: "Every LLM call goes through 
  ai/llm call_structured(). Never call the SDK directly." Three files:

  ai/pricing.py — a dict of model_id -> (input $/1M tokens, output $/1M tokens).
  One pure function, cost_usd(model, tokens_in, tokens_out). Unlisted models
  price at 0.0 rather than raising, so an unfamiliar model never blocks a call —
  it just under-reports cost visibly (a 0.0 on the agent_runs row is a flag to
  fix the table, not a hidden lie).

  ai/budget.py — check_budget(org_id). Opens an org_connection, reads
  organizations.monthly_budget_usd (null = unlimited), sums agent_runs.cost_usd
  for the current calendar month for that org, and raises BudgetExceededError if
  spend ≥ budget. Notice there's no separate "running total" column anywhere —
  the ledger (agent_runs) is the source of truth, summed live. That means it can
  never drift out of sync with actual spend.

  ai/llm.py — call_structured(), the wrapper itself. Walking through what
  happens on one call:

  1. Budget gate first (ai/llm.py:119-120): if org_id is given, check_budget()
     runs before any network call. Spend a budget only after passing it, not
     after the fact.
  2. Build the request: system prompt + user prompt + the Pydantic schema's JSON
     shape appended as text, telling the model exactly what fields to return
     (ai/llm.py:122-133).
  3. One retry loop handles two different failure modes (ai/llm.py:142-184):
     - Transient failures (network drop, timeout, 429, 5xx) → sleep with
       exponential backoff, retry, up to 2 extra attempts. A 400 (bad request)
       is not retried — retrying a malformed request just wastes 3x the time
       failing the same way.
     - Schema validation failures (model returned junk or wrong shape) → append
       the validation error to the conversation and ask it to correct itself,
       once. If it's still wrong, give up loudly (AgentOutputError) rather than
       silently returning garbage.
  4. Cost and metadata: every successful call returns (parsed_output, RunMeta),
     where RunMeta carries model, tokens_in/out, cost_usd, latency_ms, attempts,
     and status (ok/repaired/fallback) — this is exactly what gets written to
     an agent_runs row later, so every AI decision is traceable to what it cost
     and how many tries it took.

  The one deliberate escape hatch: org_id=None skips the budget check entirely 
  and needs no database. I added this after discovering the CLI demo entries
  (python -m agents.research) were hitting Postgres just to check a budget for a
  "demo" org that didn't exist — which directly broke agents/CLAUDE.md's
  requirement that agent CLIs run "with no DB or server." Now: no org_id → no DB
  touched at all, pure LLM call. The orchestrator (once built) will always pass
  a real org_id, so this is a dev-only door, not a way to dodge budgets in
  production.

  ---

  4. Agents: agents/ — pure functions, one per specialist

  Two shared files first:

  agents/types.py — Fact (a claim + its source URL) and Chunk (a retrieved KB
  chunk: id, content, source, doc_type) are used across almost every agent's
  input/output. Channel = Literal["email", "linkedin", "whatsapp", "call"].

  agents/prompt_render.py — load_prompt(__file__, "name") reads <module's 
  folder>/prompts/name.md at import time (so every agent module has a
  DEFAULT_PROMPT module-level constant, loaded once). render_template(text, 
  **values) does a dumb {{key}} → values["key"] substitution — no logic, no
  loops, because prompt text is trusted content, not something needing a real
  templating engine.

  Now the seven agents. Each one follows the same shape: Pydantic input model → 
  build a plain-text user message from it → call_structured(...) → (sometimes) a
  code-level correction → return (output, RunMeta). What differs is the schema
  and what gets overridden:

  - research.py — no KB, no overrides. Takes a prospect + web snippets code
    already fetched, asks the model to summarize into company_summary, industry,
    likely_pains, and — critically — facts: list[Fact], each with a source_url.
    This is the raw material everything downstream cites.
  - fitment.py — this is the clearest example of "the LLM proposes, the code
    disposes." The model is only ever asked for a raw score (0-100) plus
    criteria_met/criteria_missed/reason — I deliberately gave it a schema
    (_ModelOutput) with no verdict field at all. run() then calls
    _verdict_for(score, fit_threshold) in plain Python: score >= threshold → 
    "fit", more than 20 points under → "no_fit", otherwise "review". The model
    literally cannot pick the verdict even if it wanted to — that's why
    test_agents.py can prove this with a parametrized test feeding fake scores
    through three thresholds.
  - strategy.py — the "one brain per prospect." Input is a compact prospect
    summary + a compact timeline string (not raw history) + channel policy +
    touch counts, and an optional follow_up_hint (Follow-up's own suggestion,
    passed through as advisory data only). Output is one of
    send/call/wait/stop/escalate plus a plain-English reason. Supports
    tier="strong" for hard cases per spec's model-routing table.
  - personalisation.py — writes the actual outbound message. Temperature 0.7
    (creative), unlike everything else which runs at 0.0-0.2 (deterministic).
    Its default prompt has {{channel}}/{{intent}}/{{rep_signature}} placeholders
    that run() fills via render_template before the call — the one agent where
    the templating machinery is actually exercised at call time. Output includes
    facts_used/kb_chunks_used (indices), so grounding downstream knows what to
    check.
  - conversation.py — classifies an inbound reply. Same "code disposes" pattern
    as fitment: _mentions_unsubscribe(reply) checks for phrases like
    "unsubscribe"/"stop"/"remove me" and force-overwrites intent="unsubscribe"
    and needs_human=False after the model call, regardless of what the model
    classified it as. A model that misreads "please unsubscribe me" as
    "interested" still gets overridden — this is tested directly.
  - follow_up.py — advisory only, no overrides. Suggests whether/how to
    re-engage; Strategy decides whether to actually listen to it.
  - voice.py — two unrelated things live here because they're both
    "voice-shaped": CALL_SCRIPT_TEMPLATE (the text pushed to DronaHQ's voice
    agent to configure a live call — never goes through call_structured, it's
    config, not a call our backend makes) and run() (a real call_structured call
    that runs after the call ends, extracting
    outcome/qualified/objections/next_step from the transcript).

  ---

  5. Knowledge base: rag/

  chunking.py — split_into_chunks(text): word-based sliding window, ~400 words
  with ~50 overlap, so a fact sitting near a chunk boundary still appears whole
  in at least one chunk.

  ingest.py — ingest_document(org_id, doc_type, title, content, ...). Hashes the
  content (SHA-256) and checks for an existing document with the same checksum
  for this org and campaign before doing anything — re-uploading the same doc is
  a no-op, not duplicate work. Otherwise: insert the kb_documents row, chunk
  the content, embed() all chunks in one batch call, insert each as a kb_chunks
  row with a pgvector literal ("[0.1,0.2,...]" text format). Everything happens
  inside one org_connection transaction — if embedding fails partway, nothing
  partial is left behind.

  retrieval.py — retrieve(org_id, query_text, doc_types, campaign_id): embeds
  the query, then runs a cosine-distance ORDER BY against kb_chunks, filtered to
  org_id = this org AND (campaign_id = this campaign OR campaign_id IS NULL) 
  AND doc_type = ANY(types). That OR campaign_id IS NULL clause is what lets
  org-wide documents (case studies, company overview) surface for every campaign
  while campaign-specific documents (a campaign's own ICP definition) stay
  scoped. Rows below a similarity floor (0.15) are dropped — "not similar
  enough" is treated as "nothing found," not "here's our best guess."

  grounding.py — the last guardrail before anything customer-facing ships.
  check_grounding(message, sources) asks a small model at temperature 0 to list
  every factual claim in the draft and mark each supported/unsupported against
  the sources actually used. forces_escalation(output) is a one-line code check:
  if risky_topics (pricing/legal/commitment) is non-empty, escalate to a human
  — regardless of whether all_supported came back true. The model flagging a
  claim doesn't get "argued down" by anything else in the output.

  ---

  6. Measurement: eval/

  llm_judge.py — judge_message(text) scores a generated message 1-5 on four axes
  (personalisation, accuracy, clarity, call-to-action) using the strong model
  at temperature 0, so the same message scores the same way every time you
  re-run it.

  runner.py — run_eval(org_id, agent, ...) pulls labelled rows from eval_sets
  (each row: input + expected, both JSON), and dispatches by agent name:
  fitment/conversation are scored as accuracy (does output.verdict/output.intent
  match expected?); personalisation is scored via the LLM judge (no
  ground-truth "correct" message exists, only quality). Writes one aggregate row
  to eval_results either way.

  run.py — the CLI: python -m eval.run --agent fitment --org <id>.

  ---

  7. What's tested vs. what isn't

  tests/ currently proves: tenant isolation (RLS + repo layer, from before this
  session), the LLM wrapper's happy path / one-shot repair / budget gate, the
  budget math itself, and the two "code disposes" guarantees (fitment verdict,
  conversation unsubscribe override). It does not test each individual agent's
  prompt quality, RAG retrieval against real pgvector (skipped when the
  extension isn't locally installed — same pattern as the existing KB test), or
  eval scoring end-to-end. That's a deliberate scope call, not an oversight —
  you asked to keep tests to what's crucial for running the app, not exhaustive
  coverage.

  ---

  8. How this becomes a working app — the real workflow

  Here's the important part: none of the layers above call each other yet. A
  prospect record exists nowhere, because there's no API route to create one and
  no orchestrator to move it through its lifecycle. What exists is a set of
  correct, tested building blocks. Here's how they're meant to click together
  once orchestrator/ and api/ get built (per spec §7 and §9):

  1. DronaHQ UI  --POST /campaigns/{id}/prospects-->  api/
  --OrgScopedRepo.insert-->  prospects, campaign_prospects (stage=discovered)

  2. worker (orchestrator/, not built) polls campaign_prospects
     where stage='discovered' and next_action_at <= now()

  3. For that prospect, the worker:
       a. fetches web snippets (channels/ or a research helper, not built)
       b. calls agents.research.run(input, org_id=real_org_id)
       c. INSERTS an agent_runs row itself (model, tokens, cost, reason,
  kb_chunk_ids)
          <- agents never touch the DB; the orchestrator does this bookkeeping
       d. updates campaign_prospects.stage = 'researched'

  4. Next tick: rag.retrieval.retrieve(...) pulls ICP chunks
     -> agents.fitment.run(research_output, icp_chunks, fit_threshold)
     -> code (not the model) derives verdict -> stage = 'qualified' or
  'disqualified'

  5. agents.strategy.run(prospect_summary, timeline, ...) decides the next
  action
     -> orchestrator/policy_gate.check_gate() (NOT BUILT) must approve it
        before anything external happens - kill switch, pause levels,
        suppression list, budget, rate limits all live here

  6. If action = "send":
       rag.retrieval.retrieve(...) gets case studies/example messages
       -> agents.personalisation.run(facts, kb_chunks, ...) drafts the message
       -> rag.grounding.check_grounding(draft, sources_used)
          - all_supported=false -> regenerate once, then -> approval queue
          - risky_topics present -> escalate to human, no exceptions
       -> policy_gate.check_gate() again, immediately before send (a pause
          mid-flight must still block it)
       -> channels/email.py (NOT BUILT) actually sends it
       -> a `touches` row is written: grounded=true, status='sent'

  7. Reply comes in via a webhook -> tenancy.auth.resolve_org_by_webhook_token()
     -> agents.conversation.run(reply, thread, kb_chunks) classifies it
        (unsubscribe phrases force-override the model's classification, in code)
     -> wakes agents.strategy again with the updated timeline

  8. No reply after N days -> agents.follow_up.run() offers a hint
     -> agents.strategy.run(..., follow_up_hint=hint) still makes the final call

  9. Throughout: every agent call's RunMeta (cost, tokens, status) is logged
     to agent_runs by the orchestrator, which is what /metrics, /compare,
     and /usage (not built) will later aggregate from - and what eval.runner
     scores prompt versions against over time.

  The concrete gap between "AI layer complete" and "a demo that runs":
  orchestrator/ (worker loop, step machine, and — non-negotiable per CLAUDE.md —
  policy_gate.check_gate(), which nothing currently enforces), channels/
  (actually sending an email/WhatsApp message/placing a call — right now sending
  is a no-op that doesn't exist), and api/ routes beyond /health (campaigns,
  prospects, kb, controls — the surface DronaHQ's UI would actually call). The
  AI layer can correctly research, qualify, decide, write, and fact-check a
  message in isolation right now (provable via each agent's CLI entry) — but
  nothing yet takes a real prospect from a database row through that pipeline to
  a sent message on a deployed URL.

  Given the build order in spec §16, the natural next step is
  orchestrator/policy_gate.py (small, and it's the thing every external action
  must pass through) followed by a first vertical slice of api/ (create a
  campaign, add a prospect) so there's something for the orchestrator to
  actually pull work from.

✻ Churned for 1m 50s · done 3:22 AM

❯ what all external factors do i need to setup for our app to work?             

  Read 1 file, ran 1 shell command (ctrl+o to expand)

● Here's what needs to exist outside the codebase, split by how soon you'll
  actually need it.

  Tier 0 — needed right now, to run what's already built

  These are the only things blocking pytest, uvicorn, and the agent CLIs from
  working with real (not faked) data:

  Env var: DATABASE_URL
  What it is: Supabase Postgres connection string, schema-owning role
  How to get it: Create a free Supabase project → Project Settings → Database →
  connection string. Must have pgvector enabled (Supabase turns it on by
  default under Database → Extensions; confirm vector is listed).
  ────────────────────────────────────────
  Env var: APP_DATABASE_URL
  What it is: The non-RLS-bypassing app_user role's connection string
  How to get it: Created automatically by python -m db.migrate (migration 0001);

  you then run ALTER ROLE app_user WITH PASSWORD '...' once, out of band, and
  put that string here.
  ────────────────────────────────────────
  Env var: SECRETS_KEY
  What it is: AES-256-GCM key for encrypting integration credentials
  How to get it: Generate locally: python -c "from tenancy.crypto import 
  generate_secrets_key as g; print(g())" — not from any external service.
  ────────────────────────────────────────
  Env var: LLM_BASE_URL, LLM_API_KEY
  What it is: Any OpenAI-compatible LLM provider
  How to get it: Simplest: an OpenAI API key (platform.openai.com). Any
  OpenAI-compatible proxy (Azure OpenAI, OpenRouter, Groq, etc.) also works —
  the wrapper doesn't care which.
  ────────────────────────────────────────
  Env var: MODEL_SMALL, MODEL_STRONG, EMBED_MODEL
  What it is: Model IDs from that provider
  How to get it: e.g. gpt-4o-mini, gpt-4o, text-embedding-3-small if using
  OpenAI
  directly. Must also be entries in ai/pricing.py's price table, or cost will
  silently log as $0.

  Without a real Postgres, pytest still passes (it spins up its own throwaway
  cluster locally) — but uvicorn and any real agent run need the above. Local
  Postgres works too instead of Supabase, but Supabase is what the spec targets
  for deployment and gets you pgvector without installing anything.

  Tier 1 — needed for the actual buildathon demo (per spec §16's "never cut" 
  list)

  Nothing in code touches these yet (channels/, orchestrator/ aren't built), but
  they're accounts/credentials you should line up now since the spec flags
  several as "verify early, because these decide the design":

  - DronaHQ account (control plane + Agentic Platform + MCP layer) — this is 15
    of the rubric's 100 points and the demo's UI. Needed regardless of backend
    progress.
  - DronaHQ voice agent access — spec explicitly says to verify in the first
    hours: can it place outbound calls, does it send a transcript/webhook, can 
    it call a custom book_meeting tool, what languages does it support. If any
    of that is missing, you need a fallback voice provider (Vapi/Retell) instead
    — better to know now than at the deadline.
  - A test mailbox with an app password (Gmail/Outlook) — for SMTP send + IMAP
    polling. An app password is simpler than OAuth for hackathon speed; spec
    lists Google OAuth as a "cut if behind" item.
  - Twilio account + WhatsApp sandbox number — free tier is enough; sandbox mode
    only reaches numbers that have joined it, which is fine for a demo.
  - A deployment target — Render or Railway (spec's suggestion): one web service
    (API) + one worker process. The rubric requires a deployed URL, not a local
    build.

  Tier 2 — nice-to-have / explicit cut candidates

  - Google Calendar OAuth credentials — for real free/busy + event creation.
    Spec's own fallback if you're short on time: a plain booking link (Cal.com)
    with a webhook — genuinely fine to use instead.
  - An enrichment provider (e.g. Apollo) for the Research agent — spec says "try
    it early but do not depend on it." Web search + page fetch (no paid API) is
    the baseline.
  - LinkedIn — spec wants a simulator, not a real integration. No external
    account needed here at all.

  What I'd set up first, in order

  1. Supabase project + pgvector confirmed on → run migrations → set app_user's
     password.
  2. An LLM API key (OpenAI is the path of least resistance) → confirm one
     agent's CLI runs for real (python -m agents.research).
  3. DronaHQ account — start this in parallel, since it's a rubric category on
     its own and has the most unknowns (voice agent capabilities).
  4. Mailbox app password + Twilio sandbox — only needed once channels/ actually
     gets built, but quick to grab now.
  5. Render/Railway account — only needed once there's something worth
     deploying, but worth confirming the free tier supports a worker + web
     service combo before you're relying on it late.

  Want me to add a docs/api_contract.md-adjacent checklist file (or just expand
  .env.example) capturing all of this so it's not just in chat?

