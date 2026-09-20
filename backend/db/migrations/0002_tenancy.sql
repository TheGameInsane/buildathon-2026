-- Tenancy: organizations and everything auth/onboarding needs before a campaign exists.
-- Spec: docs/spec.md section 5 (multi-tenancy) and section 6 (data model).

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null, slug text unique not null,
  status text not null default 'sandbox_only' check (status in ('active','sandbox_only','suspended')),
  monthly_budget_usd numeric(10,2),                          -- null = unlimited
  global_contact_cap_7d int default 3,
  created_at timestamptz default now()
);

create table org_members (
  org_id uuid references organizations(id), user_ref text,
  role text not null check (role in ('admin','manager','rep','viewer')),
  primary key (org_id, user_ref)
);

create table api_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id),                 -- null = platform admin key
  key_hash text unique not null, label text, created_at timestamptz default now(), revoked_at timestamptz
);

create table company_profiles (
  org_id uuid primary key references organizations(id),
  company_name text not null, website text, one_liner text, description text,
  products jsonb,                                           -- [{"name","summary","url"}]
  value_props text[], default_tone text, brand_voice text, languages text[],
  sender_footer text, unsubscribe_text text,
  disclaimer text                                           -- optional UI/message disclaimer
);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  provider text not null,   -- email_smtp_imap, gmail_oauth, twilio_whatsapp, dronahq_voice, google_calendar, web_search, enrichment
  mode text not null default 'sandbox' check (mode in ('sandbox','live')),
  config_encrypted bytea,                                   -- AES-GCM, key from SECRETS_KEY env var
  webhook_token text unique,                                -- opaque token in inbound webhook URLs
  status text, last_checked_at timestamptz,
  unique (org_id, provider)
);

create table platform_controls (
  id int primary key default 1 check (id = 1),
  kill_switch boolean default false, updated_by text, updated_at timestamptz default now()
);

create table org_controls (
  org_id uuid primary key references organizations(id),
  kill_switch boolean default false, channel_pauses jsonb default '{}',
  updated_by text, updated_at timestamptz default now()
);

-- ===== Row-level security =====
-- organizations: a connection scoped to app.org_id may only ever see its own row.
alter table organizations enable row level security;
create policy organizations_self on organizations
  using (id = current_setting('app.org_id', true)::uuid);

-- org_members, company_profiles, integrations, org_controls: plain org_id = current org.
alter table org_members enable row level security;
create policy org_members_isolation on org_members
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table company_profiles enable row level security;
create policy company_profiles_isolation on company_profiles
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table integrations enable row level security;
create policy integrations_isolation on integrations
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

alter table org_controls enable row level security;
create policy org_controls_isolation on org_controls
  using (org_id = current_setting('app.org_id', true)::uuid)
  with check (org_id = current_setting('app.org_id', true)::uuid);

-- api_keys: RLS still applies to ordinary reads/writes (a tenant only ever sees its own
-- keys' hashes and labels, never another org's), but authentication itself must resolve
-- org_id from a bare key BEFORE app.org_id is known, which the isolation policy below
-- would otherwise make impossible (current_setting is null -> every row hidden). That
-- lookup is carved out through a narrow SECURITY DEFINER function instead of disabling
-- RLS on the table: it runs with the owning (migration) role's privileges, which bypass
-- RLS, but it can only ever return an id and org_id for a hash match — never the table's
-- other rows, never any credential.
alter table api_keys enable row level security;
create policy api_keys_isolation on api_keys
  using (org_id is not distinct from current_setting('app.org_id', true)::uuid)
  with check (org_id is not distinct from current_setting('app.org_id', true)::uuid);

create function resolve_api_key(p_key_hash text)
returns table (id uuid, org_id uuid)
language sql security definer set search_path = public as $$
  select id, org_id from api_keys where key_hash = p_key_hash and revoked_at is null;
$$;
revoke all on function resolve_api_key(text) from public;
grant execute on function resolve_api_key(text) to app_user;

-- integrations webhook tokens have the same chicken-and-egg problem: the inbound
-- webhook carries the token in the URL and org_id must be resolved from it first.
create function resolve_org_by_webhook_token(p_token text)
returns uuid
language sql security definer set search_path = public as $$
  select org_id from integrations where webhook_token = p_token;
$$;
revoke all on function resolve_org_by_webhook_token(text) from public;
grant execute on function resolve_org_by_webhook_token(text) to app_user;

-- platform_controls carries no org_id: it is platform-wide, not a tenant table, so it
-- gets no RLS policy (matches spec section 6's "every TENANT table carries org_id").

-- ===== Grants =====
grant select, update on organizations to app_user;
grant select, insert, update, delete on org_members to app_user;
grant select, insert, update on api_keys to app_user;
grant select, insert, update on company_profiles to app_user;
grant select, insert, update, delete on integrations to app_user;
grant select on platform_controls to app_user;
grant select, insert, update on org_controls to app_user;
