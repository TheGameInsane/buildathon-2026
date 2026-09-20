-- Eval sets and results (section 12 / measurement rubric). org_id is nullable on
-- eval_sets to allow platform-wide golden sets shared across tenants, same pattern as
-- campaign_templates.
create table eval_sets (
  id uuid primary key default gen_random_uuid(), org_id uuid,
  agent text, campaign_id uuid, input jsonb, expected jsonb
);
create table eval_results (
  id uuid primary key default gen_random_uuid(), org_id uuid,
  agent text, campaign_id uuid, prompt_version_id uuid, dataset text,
  accuracy numeric, judge_scores jsonb, details jsonb, created_at timestamptz default now()
);

alter table eval_sets enable row level security;
create policy eval_sets_isolation on eval_sets
  using (org_id = current_setting('app.org_id', true)::uuid or org_id is null)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table eval_results enable row level security;
create policy eval_results_isolation on eval_results
  using (org_id = current_setting('app.org_id', true)::uuid or org_id is null)
  with check (org_id = current_setting('app.org_id', true)::uuid);

grant select, insert, update, delete on eval_sets, eval_results to app_user;
