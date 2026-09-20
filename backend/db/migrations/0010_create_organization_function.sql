-- Creating an organization (POST /platform/orgs, api/platform.py) has the same
-- chicken-and-egg problem as resolve_api_key / resolve_org_by_webhook_token in
-- 0002_tenancy.sql, three times over: organizations_self, org_members_isolation and
-- api_keys_isolation are all "= current org", and there is no "current org" yet for
-- any of the rows this bootstrap needs to insert.
--
-- A narrow SECURITY DEFINER function is the same fix as those two: it runs with the
-- migration-owning role's privileges, but does exactly one thing - create a new org,
-- its first admin member and its first API key together - never reads or touches
-- anything else. The raw key itself is generated in Python (tenancy.api_keys); only
-- its hash crosses into this function, same as everywhere else in the codebase.
create function create_organization(
  p_name text, p_slug text, p_admin_user_ref text, p_api_key_hash text
)
returns organizations
language plpgsql security definer set search_path = public as $$
declare
  new_org organizations;
begin
  insert into organizations (name, slug) values (p_name, p_slug) returning * into new_org;
  insert into org_members (org_id, user_ref, role) values (new_org.id, p_admin_user_ref, 'admin');
  insert into api_keys (org_id, key_hash, label) values (new_org.id, p_api_key_hash, 'default');
  return new_org;
end;
$$;

revoke all on function create_organization(text, text, text, text) from public;
grant execute on function create_organization(text, text, text, text) to app_user;
