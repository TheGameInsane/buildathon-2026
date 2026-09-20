-- Sales domain: reps, campaigns, prospects and the tables that track a prospect through
-- a campaign. Every row here carries org_id (spec section 6).

create table reps (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations(id),
  name text, email text, timezone text, signature text,
  work_start time, work_end time, work_days int[],          -- 1=Mon..7=Sun
  daily_caps jsonb,                                          -- {"email":30,"whatsapp":20,"call":10}
  status text default 'active' check (status in ('active','offboarded'))
);

create table campaign_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),                 -- null = platform template
  key text, name text, description text,
  config jsonb, default_prompts jsonb                        -- prompt templates use company-profile placeholders
);

create table campaigns (
  id uuid primary key default gen_random_uuid(), org_id uuid not null references organizations(id),
  name text not null, description text, owner text,
  status text not null default 'draft' check (status in ('draft','live','paused','completed','archived')),
  objective text, template_key text,
  icp jsonb, geography jsonb, target_roles text[],
  company_criteria jsonb, exclusion_criteria jsonb, reference_profiles jsonb,
  languages text[],
  channels jsonb,          -- {"email":{"enabled":true,"paused":false},"call":{"enabled":true,"paused":false}, ...}
  channel_policy jsonb,    -- e.g. {"call":"after_engagement_only"}
  daily_limits jsonb, approval_rules jsonb, timezone_rules jsonb,
  fit_threshold int default 70,
  demo_seconds_per_day int,                                  -- null = real time
  parent_campaign_id uuid references campaigns(id), variant_label text,
  preview_confirmed_at timestamptz,
  created_by text, created_at timestamptz default now(), updated_at timestamptz default now()
);

create table rep_campaigns (
  org_id uuid not null, rep_id uuid references reps(id), campaign_id uuid references campaigns(id),
  use_rep_identity boolean default true, primary key (rep_id, campaign_id)
);

create table prompt_versions (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  campaign_id uuid references campaigns(id) not null,
  agent text not null,      -- 'system' (campaign-level) or one of the 7 agent names
  version int not null, body text not null, note text,
  created_by text, created_at timestamptz default now(),
  unique (campaign_id, agent, version)
);

create table campaign_agents (
  org_id uuid not null, campaign_id uuid references campaigns(id), agent text,
  enabled boolean default true, paused boolean default false,
  config jsonb,             -- thresholds, escalation rules
  active_prompt_version_id uuid references prompt_versions(id),
  primary key (campaign_id, agent)
);

create table prospects (    -- one row per real person per organization, shared across that org's campaigns
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  full_name text, email text, phone text, linkedin_url text,
  company text, domain text, role text, country text,
  source text, referral_from uuid references prospects(id),
  owner_campaign_id uuid references campaigns(id),           -- set when a campaign claims the prospect
  is_test_contact boolean default false, is_seeded boolean default false,
  created_at timestamptz default now()
);
create unique index on prospects (org_id, lower(email)) where email is not null;

create table campaign_prospects (   -- "cp": the per-campaign state record
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  campaign_id uuid references campaigns(id), prospect_id uuid references prospects(id),
  stage text not null default 'discovered' check (stage in
    ('discovered','researched','qualified','disqualified','contacted','engaged','meeting','opportunity','stopped')),
  fit_verdict text, fit_score int, research jsonb, rep_id uuid references reps(id),
  step_number int default 0, failures int default 0,
  next_action_at timestamptz, is_seeded boolean default false,
  unique (campaign_id, prospect_id)
);
create index on campaign_prospects (next_action_at) where stage not in ('disqualified','stopped');

create table agent_runs (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  cp_id uuid references campaign_prospects(id), campaign_id uuid, agent text,
  prompt_version_id uuid references prompt_versions(id),
  input jsonb, output jsonb, reason text, kb_chunk_ids uuid[],
  model text, tokens_in int, tokens_out int, cost_usd numeric(10,6),
  latency_ms int, attempts int, status text,                 -- ok | repaired | fallback | failed
  error text, created_at timestamptz default now(), is_seeded boolean default false
);

create table touches (      -- the unified cross-channel timeline
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  cp_id uuid references campaign_prospects(id),
  step_number int, channel text, direction text,             -- outbound | inbound | system
  kind text,                                                 -- email, linkedin_connect, linkedin_message, whatsapp, call, meeting, note
  status text,   -- planned, held, rescheduled, awaiting_approval, sent, delivered, failed, received, cancelled
  held_reason text, subject text, body text,
  provider_id text, thread_key text,
  agent_run_id uuid references agent_runs(id), prompt_version_id uuid,
  grounded boolean, idempotency_key text unique,
  scheduled_for timestamptz, sent_at timestamptz,
  created_at timestamptz default now(), is_seeded boolean default false
);

create table approvals (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  touch_id uuid references touches(id), campaign_id uuid,
  reason text,               -- first_touch | ungrounded | pricing | rule | escalation
  status text default 'pending', edited_body text,
  decided_by text, decided_at timestamptz, created_at timestamptz default now()
);

create table conflicts (
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  prospect_id uuid references prospects(id), campaign_ids uuid[],
  type text,                 -- duplicate_outreach | frequency | conflicting_instructions
  status text default 'open', resolution jsonb,
  resolved_by text, resolved_at timestamptz, created_at timestamptz default now()
);

create table suppression (   -- per organization
  id uuid primary key default gen_random_uuid(), org_id uuid not null,
  email text, phone text, linkedin_url text, reason text, source_cp_id uuid,
  created_at timestamptz default now()
);

-- ===== Row-level security: plain org_id = current org for every table above,
-- except campaign_templates where org_id is null for platform-wide templates. =====
alter table reps enable row level security;
create policy reps_isolation on reps
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table campaign_templates enable row level security;
create policy campaign_templates_isolation on campaign_templates
  using (org_id = current_setting('app.org_id', true)::uuid or org_id is null)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table campaigns enable row level security;
create policy campaigns_isolation on campaigns
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table rep_campaigns enable row level security;
create policy rep_campaigns_isolation on rep_campaigns
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table prompt_versions enable row level security;
create policy prompt_versions_isolation on prompt_versions
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table campaign_agents enable row level security;
create policy campaign_agents_isolation on campaign_agents
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table prospects enable row level security;
create policy prospects_isolation on prospects
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table campaign_prospects enable row level security;
create policy campaign_prospects_isolation on campaign_prospects
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table agent_runs enable row level security;
create policy agent_runs_isolation on agent_runs
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table touches enable row level security;
create policy touches_isolation on touches
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table approvals enable row level security;
create policy approvals_isolation on approvals
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table conflicts enable row level security;
create policy conflicts_isolation on conflicts
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table suppression enable row level security;
create policy suppression_isolation on suppression
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

-- ===== Grants =====
grant select, insert, update, delete on
  reps, campaign_templates, campaigns, rep_campaigns, prompt_versions, campaign_agents,
  prospects, campaign_prospects, agent_runs, touches, approvals, conflicts, suppression
  to app_user;
