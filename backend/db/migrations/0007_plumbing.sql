-- Inbound idempotency and the audit/activity log.

create table webhook_events (   -- inbound idempotency
  id uuid primary key default gen_random_uuid(), org_id uuid,
  provider text, external_id text, payload jsonb, processed_at timestamptz,
  unique (provider, external_id)
);

create table activity_log (     -- audit trail and live feed
  id bigserial primary key, org_id uuid not null, at timestamptz default now(),
  actor text,                 -- user:priya | agent:strategy | worker | mcp:copilot | mcp:claude-code
  campaign_id uuid, cp_id uuid, action text, summary text, payload jsonb
);

alter table webhook_events enable row level security;
create policy webhook_events_isolation on webhook_events
  using (org_id = current_setting('app.org_id', true)::uuid or org_id is null)
  with check (org_id = current_setting('app.org_id', true)::uuid or org_id is null);

alter table activity_log enable row level security;
create policy activity_log_isolation on activity_log
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

grant select, insert, update on webhook_events to app_user;
grant select, insert on activity_log to app_user;
grant usage on sequence activity_log_id_seq to app_user;
