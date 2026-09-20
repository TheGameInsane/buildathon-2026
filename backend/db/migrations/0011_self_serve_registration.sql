-- Self-serve tenant registration (spec section 5: "Platform admin (or self-serve
-- signup) creates the organization"). A human registering through the frontend gets a
-- real account — email + password — separate from the org-scoped API keys machine
-- clients use. org_members already models "a person's membership and role in an org";
-- this extends it with login credentials rather than introducing a parallel table.
alter table org_members add column id uuid unique default gen_random_uuid();
alter table org_members add column name text;
alter table org_members add column email text unique;
alter table org_members add column password_hash text;

-- create_organization (0010) gains three optional trailing params so the existing
-- platform-admin call site (api/platform.py, 4 positional args) keeps working
-- unchanged, while self-serve registration can pass all of them.
drop function if exists create_organization(text, text, text, text);

create function create_organization(
  p_name text, p_slug text, p_admin_user_ref text, p_api_key_hash text,
  p_admin_email text default null, p_admin_password_hash text default null,
  p_admin_name text default null
)
returns organizations
language plpgsql security definer set search_path = public as $$
declare
  new_org organizations;
begin
  insert into organizations (name, slug) values (p_name, p_slug) returning * into new_org;
  insert into org_members (org_id, user_ref, role, email, password_hash, name)
    values (new_org.id, p_admin_user_ref, 'admin', p_admin_email, p_admin_password_hash, p_admin_name);
  insert into api_keys (org_id, key_hash, label) values (new_org.id, p_api_key_hash, 'default');
  return new_org;
end;
$$;

revoke all on function create_organization(text, text, text, text, text, text, text) from public;
grant execute on function create_organization(text, text, text, text, text, text, text) to app_user;

-- Login must resolve a member by email before any org context exists too - the same
-- bootstrap problem as resolve_api_key (0002_tenancy.sql), solved the same way: a
-- narrow SECURITY DEFINER lookup that returns only what login needs, never a full row
-- scan or any other member's data.
create function resolve_member_by_email(p_email text)
returns table (org_id uuid, member_id uuid, password_hash text, role text, name text)
language sql security definer set search_path = public as $$
  select org_id, id, password_hash, role, name
  from org_members
  where lower(email) = lower(p_email) and password_hash is not null;
$$;

revoke all on function resolve_member_by_email(text) from public;
grant execute on function resolve_member_by_email(text) to app_user;
